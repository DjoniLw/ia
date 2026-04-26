import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { appConfig } from '../../config/app.config'
import { companyConfig } from '../../config/company.config'
import { prisma } from '../../database/prisma/client'
import { redis } from '../../database/redis/client'
import { logger } from '../../shared/logger/logger'
import { buildTransferEmailHtml } from '../../shared/utils/transfer-email'
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/app-error'
import { generateId } from '../../shared/utils/id'
import { authRepository } from './auth.repository'
import { NotificationsService } from '../notifications/notifications.service'
import type { FastifyInstance } from 'fastify'
import type { RegisterClinicDto, LoginDto, ProfessionalLoginDto } from './auth.dto'

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12
const MAX_FAILED_ATTEMPTS = 5
const LOCK_TTL_SECONDS = 900 // 15 min
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const TRANSFER_TOKEN_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours
const TRANSFER_RESEND_COOLDOWN_SECONDS = 60

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

function normalizeCnpj(value?: string | null): string | undefined {
  const digits = value?.replace(/\D/g, '') ?? ''
  return digits.length > 0 ? digits : undefined
}

function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

function refreshKey(hash: string) {
  return `user-refresh:${hash}`
}

function lockKey(userId: string) {
  return `login-lock:${userId}`
}

async function checkLockout(userId: string): Promise<void> {
  try {
    const attempts = await redis.get(lockKey(userId))
    if (attempts && parseInt(attempts, 10) >= MAX_FAILED_ATTEMPTS) {
      throw new ForbiddenError('Too many failed attempts. Try again in 15 minutes.')
    }
  } catch (err) {
    // Re-throw business errors; warn and skip lockout when Redis is unavailable
    // so a Redis outage does not block all login attempts.
    if (err instanceof ForbiddenError) throw err
    logger.warn({ err }, 'Redis unavailable — skipping lockout check')
  }
}

async function recordFailedAttempt(userId: string): Promise<void> {
  try {
    const key = lockKey(userId)
    const attempts = await redis.incr(key)
    if (attempts === 1) {
      await redis.expire(key, LOCK_TTL_SECONDS)
    }
  } catch {
    // Redis unavailable — failed attempt not recorded
  }
}

async function clearLockout(userId: string): Promise<void> {
  try {
    await redis.del(lockKey(userId))
  } catch {
    // Redis unavailable — lockout not cleared
  }
}

// ─── AuthService ──────────────────────────────────────────────────────────────

export class AuthService {
  private notifications = new NotificationsService()

  constructor(private readonly app: FastifyInstance) {}

  // ── Register ────────────────────────────────────────────────────────────────

  async registerClinic(dto: RegisterClinicDto) {
    const clinicDocument = normalizeCnpj(dto.clinicDocument)
    const activeMemberships = await authRepository.findActiveMembershipsByEmail(dto.email)
    const sourceMembership = activeMemberships[0]
    const existingUnverified = await authRepository.findLatestUnverifiedClinicByEmail(dto.email)

    if (appConfig.isProduction) {
      const pendingTransfer = await authRepository.findLatestPendingTransferByEmail(dto.email)
      if (pendingTransfer?.kind === 'clinic_registration') {
        throw new AppError(
          'Já existe uma transferência pendente para este e-mail. Verifique sua caixa de entrada.',
          409,
          'TRANSFER_PENDING',
        )
      }
    }

    if (!appConfig.isProduction) {
      try {
        await redis.ping()
      } catch {
        throw new AppError(
          'Authentication service is temporarily unavailable. Please try again later.',
          503,
          'SERVICE_UNAVAILABLE',
        )
      }
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)

    let clinic: { id: string; slug: string; name: string }
    let clinicId: string
    let adminId: string

    if (existingUnverified && !sourceMembership) {
      // Account exists but was never verified — allow the user to "re-register":
      // refresh the verification token and update their data.
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
      clinic = await authRepository.updateUnverifiedClinicForReRegistration({
        clinicId: existingUnverified.id,
        name: dto.clinicName,
        phone: dto.phone,
        document: clinicDocument,
        adminName: dto.adminName,
        passwordHash,
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      })
      clinicId = existingUnverified.id
      const adminUser = await authRepository.findAdminUserByClinic(existingUnverified.id)
      adminId = adminUser?.id ?? existingUnverified.id
    } else if (appConfig.isProduction && sourceMembership) {
      // If the user hasn't explicitly confirmed the transfer yet, return a
      // conflict error so the frontend can show the appropriate dialog.
      if (!dto.confirmTransfer) {
        const isAdmin = sourceMembership.role === 'admin'
        throw new AppError(
          isAdmin
            ? `Este e-mail já está cadastrado como administrador da clínica "${sourceMembership.clinic.name}".`
            : `Este e-mail já pertence à clínica "${sourceMembership.clinic.name}".`,
          409,
          isAdmin ? 'EMAIL_CONFLICT_ADMIN' : 'EMAIL_CONFLICT_MEMBER',
          { clinicName: sourceMembership.clinic.name },
        )
      }

      const baseSlug = slugify(dto.clinicName)
      // Step 2: Verificar colisão de slug com vínculo na mesma clínica (Cenário A)
      const existingClinicForSlug = await authRepository.findClinicBySlug(baseSlug)
      if (existingClinicForSlug && sourceMembership.clinicId === existingClinicForSlug.id) {
        throw new AppError(
          `Você já possui vínculo com a empresa "${existingClinicForSlug.name}", que tem o mesmo identificador que você está tentando cadastrar.`,
          409,
          'SLUG_LINKED_SAME_CLINIC',
          { clinicName: existingClinicForSlug.name },
        )
      }
      const slug = await this.uniqueSlug(baseSlug)
      clinicId = generateId()
      adminId = generateId()

      clinic = await authRepository.createClinic({
        clinicId,
        slug,
        name: dto.clinicName,
        email: dto.email,
        phone: dto.phone,
        document: clinicDocument,
        emailVerified: false,
      })

      const transferToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + TRANSFER_TOKEN_TTL_MS)
      await authRepository.createTransferToken({
        token: transferToken,
        email: dto.email,
        sourceClinicId: sourceMembership.clinicId,
        sourceUserId: sourceMembership.id,
        targetClinicId: clinicId,
        role: 'admin',
        kind: 'clinic_registration',
        expiresAt,
      })

      await this.sendTransferEmail({
        clinicId,
        email: dto.email,
        sourceClinicName: sourceMembership.clinic.name,
        targetClinicName: dto.clinicName,
        token: transferToken,
        isAdminTransfer: sourceMembership.role === 'admin',
      })

      return {
        clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name },
        transferPending: true as const,
        emailVerificationSent: false,
      }
    } else {
      // Fresh registration
      const baseSlug = slugify(dto.clinicName)
      // Verificar colisão de slug com vínculo na mesma clínica (Cenário A — inclui dev mode)
      if (sourceMembership) {
        const existingClinicForSlug = await authRepository.findClinicBySlug(baseSlug)
        if (existingClinicForSlug && sourceMembership.clinicId === existingClinicForSlug.id) {
          throw new AppError(
            `Você já possui vínculo com a empresa "${existingClinicForSlug.name}", que tem o mesmo identificador que você está tentando cadastrar.`,
            409,
            'SLUG_LINKED_SAME_CLINIC',
            { clinicName: existingClinicForSlug.name },
          )
        }
      }
      const slug = await this.uniqueSlug(baseSlug)
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
      clinicId = generateId()
      adminId = generateId()

      clinic = await authRepository.createClinicWithAdmin({
        clinicId,
        slug,
        name: dto.clinicName,
        email: dto.email,
        phone: dto.phone,
        document: clinicDocument,
        adminId,
        adminName: dto.adminName,
        adminEmail: dto.email,
        passwordHash,
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      })
    }

    // Em ambientes não-produtivos, verifica o e-mail automaticamente — sem envio de e-mail
    if (!appConfig.isProduction) {
      await authRepository.verifyClinicEmail(clinicId)
      const tokens = await this.issueTokens(adminId, clinicId, 'admin')
      return {
        clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name },
        user: { id: adminId, name: dto.adminName, email: dto.email, role: 'admin' as const },
        emailVerificationSent: false,
        autoVerified: true as const,
        ...tokens,
      }
    }

    // Send welcome + verification email (fire-and-forget — don't block registration)
    const emailVerificationSent = Boolean(appConfig.email.apiKey)
    if (emailVerificationSent) {
      void this.sendWelcomeEmail({
        clinicId,
        email: dto.email,
        adminName: dto.adminName,
        clinicName: dto.clinicName,
        slug: clinic.slug,
        verificationToken,
      })
    }

    return {
      clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name },
      user: { id: adminId, name: dto.adminName, email: dto.email, role: 'admin' as const },
      emailVerificationSent,
    }
  }

  // ── Verify email ─────────────────────────────────────────────────────────────

  async verifyEmail(token: string) {
    const clinic = await authRepository.findClinicByVerificationToken(token)

    if (!clinic) {
      throw new NotFoundError('Verification token')
    }

    if (clinic.emailVerified) {
      // Already verified — still issue tokens so the user lands in the dashboard
      const user = await this.findAdminUser(clinic.id)
      if (!user) throw new NotFoundError('User')
      const tokens = await this.issueTokens(user.id, clinic.id, 'admin')
      return { clinic: { slug: clinic.slug }, ...tokens }
    }

    if (
      clinic.emailVerificationExpiresAt &&
      clinic.emailVerificationExpiresAt < new Date()
    ) {
      throw new ForbiddenError('O link de verificação expirou. Por favor, cadastre-se novamente.')
    }

    await authRepository.verifyClinicEmail(clinic.id)

    const user = await this.findAdminUser(clinic.id)
    if (!user) throw new NotFoundError('User')
    const tokens = await this.issueTokens(user.id, clinic.id, 'admin')

    return { clinic: { slug: clinic.slug }, ...tokens }
  }

  // ── Resend verification email ─────────────────────────────────────────────

  async resendVerification(email: string): Promise<{ sent: boolean }> {
    const clinic = await authRepository.findLatestUnverifiedClinicByEmail(email)

    // If clinic is already verified or doesn't exist, return generic response
    // to avoid leaking account existence.
    if (!clinic || clinic.emailVerified) {
      return { sent: false }
    }

    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)

    await authRepository.updateClinicVerificationToken(
      clinic.id,
      verificationToken,
      verificationExpiresAt,
    )

    const emailVerificationSent = Boolean(appConfig.email.apiKey)
    if (emailVerificationSent) {
      void this.sendWelcomeEmail({
        clinicId: clinic.id,
        email,
        adminName: '',
        clinicName: clinic.name,
        slug: clinic.slug,
        verificationToken,
      })
    }

    return { sent: emailVerificationSent }
  }

  // ── Resend transfer email ─────────────────────────────────────────────────

  async resendTransfer(email: string): Promise<{ sent: boolean }> {
    const transfer = await authRepository.findPendingTransferForResend(email)

    if (!transfer) {
      // Resposta genérica — não expõe existência do registro
      return { sent: false }
    }

    // Verificar se o e-mail pode ser enviado ANTES de qualquer mutação.
    // Sem chave de e-mail configurada não há motivo para rotacionar o token.
    const emailSent = Boolean(appConfig.email.apiKey)
    if (!emailSent) {
      return { sent: false }
    }

    // Verificar e adquirir cooldown de forma atômica com SET NX.
    // SET NX retorna 'OK' somente se a chave não existia — se retornar null
    // significa que o cooldown ainda está ativo para este e-mail.
    const cooldownKey = `transfer-resend-cooldown:${email}`
    try {
      const acquired = await redis.set(
        cooldownKey,
        '1',
        'EX',
        TRANSFER_RESEND_COOLDOWN_SECONDS,
        'NX',
      )
      if (acquired === null) {
        const ttl = await redis.ttl(cooldownKey)
        const secondsRemaining = ttl > 0 ? ttl : TRANSFER_RESEND_COOLDOWN_SECONDS
        throw new AppError(
          `Aguarde ${secondsRemaining} segundos antes de reenviar.`,
          429,
          'COOLDOWN_ACTIVE',
          { secondsRemaining },
        )
      }
    } catch (err) {
      if (err instanceof AppError) throw err
      // Fail-closed: se o Redis estiver fora, rejeitar com 503 para evitar
      // spam de e-mails durante outages (behavior seguro > disponibilidade).
      logger.error({ err }, 'Redis unavailable — rejecting resend-transfer to prevent e-mail spam')
      throw new AppError(
        'Serviço temporariamente indisponível. Tente novamente em instantes.',
        503,
        'SERVICE_UNAVAILABLE',
      )
    }

    // Rotação atômica: expirar todos os tokens pendentes e criar novo em transação.
    // Usar updateMany por email+kind para garantir que tokens duplicados também sejam expirados.
    const newToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + TRANSFER_TOKEN_TTL_MS)

    await prisma.$transaction(async (tx) => {
      await tx.transferToken.updateMany({
        where: { email, kind: transfer.kind, status: 'pending' },
        data: { status: 'expired' },
      })
      await tx.transferToken.create({
        data: {
          token: newToken,
          email,
          sourceClinicId: transfer.sourceClinicId ?? undefined,
          sourceUserId: transfer.sourceUserId ?? undefined,
          targetClinicId: transfer.targetClinicId,
          targetUserId: transfer.targetUserId ?? undefined,
          role: transfer.role,
          kind: transfer.kind,
          expiresAt,
        },
      })
    })

    void this.sendTransferEmail({
      clinicId: transfer.targetClinicId,
      email,
      sourceClinicName: transfer.sourceClinic?.name ?? '',
      targetClinicName: transfer.targetClinic?.name ?? '',
      token: newToken,
      isAdminTransfer: transfer.sourceUser?.role === 'admin',
    })

    return { sent: true }
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  async login(clinicId: string, dto: LoginDto) {
    // Block login until email is confirmed
    const clinic = await authRepository.findClinicById(clinicId)
    if (clinic && !clinic.emailVerified) {
      throw new ForbiddenError('Por favor, confirme seu e-mail antes de fazer login.')
    }

    const user = await authRepository.findUserByEmail(clinicId, dto.email)

    // Generic message: don't reveal whether the email exists
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password')
    }

    if (!user.active) {
      throw new ForbiddenError('Your account has been deactivated')
    }

    await checkLockout(user.id)

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      await recordFailedAttempt(user.id)
      throw new UnauthorizedError('Invalid email or password')
    }

    await clearLockout(user.id)
    void authRepository.updateUserLastLogin(user.id)

    const tokens = await this.issueTokens(user.id, user.clinicId, user.role, user.screenPermissions)

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    }
  }

  /** Resolve slug por e-mail ───────────────────────────────────────────────────
   * Retorna o slug da clínica associada ao e-mail. Resposta genérica se não encontrado. */
  async resolveSlug(email: string): Promise<{ slug: string | null }> {
    const memberships = await authRepository.findActiveMembershipsByEmail(email)
    const membership = memberships[0]
    if (!membership) return { slug: null }
    return { slug: membership.clinic.slug }
  }

  /**
   * Envia um e-mail de recuperação de acesso para o usuário associado ao e-mail
   * informado. Sempre retorna 200 sem expor se o e-mail existe ou não.
   */
  async recoverAccess(email: string): Promise<{ sent: boolean }> {
    const memberships = await authRepository.findActiveMembershipsByEmail(email)
    const membership = memberships[0]

    if (!membership) {
      return { sent: false }
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    const TTL_SECONDS = 60 * 60 // 1 hour

    try {
      await redis.setex(
        `pwd-reset:${resetToken}`,
        TTL_SECONDS,
        JSON.stringify({ email, clinicId: membership.clinicId, userId: membership.id }),
      )
    } catch {
      // Redis unavailable — can't issue reset token
      return { sent: false }
    }

    const resetUrl = `${appConfig.frontendUrl}/reset-password?token=${resetToken}`
    const emailSent = Boolean(appConfig.email.apiKey)

    if (emailSent) {
      void this.sendRecoverAccessEmail({
        clinicId: membership.clinicId,
        email,
        resetUrl,
      })
    }

    return { sent: emailSent }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    const redisKey = `pwd-reset:${token}`
    const raw = await redis.get(redisKey)

    if (!raw) {
      throw new AppError('Token inválido ou expirado.', 400, 'INVALID_RESET_TOKEN')
    }

    let payload: { email: string; clinicId: string; userId: string }
    try {
      payload = JSON.parse(raw) as typeof payload
    } catch {
      throw new AppError('Token inválido.', 400, 'INVALID_RESET_TOKEN')
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await authRepository.updateUserPassword(payload.userId, passwordHash)
    await redis.del(redisKey)

    return { success: true }
  }

  async confirmTransfer(token: string) {
    const transfer = await authRepository.findTransferByToken(token)
    if (!transfer) {
      throw new NotFoundError('Transfer token')
    }

    if (transfer.status !== 'pending') {
      throw new ForbiddenError('Esta transferência não está mais pendente.')
    }

    if (transfer.expiresAt < new Date()) {
      await prisma.transferToken.update({
        where: { id: transfer.id },
        data: { status: 'expired' },
      })
      throw new ForbiddenError('O link de transferência expirou.')
    }

    if (!transfer.sourceUser?.passwordHash) {
      throw new AppError('Não foi possível concluir a transferência deste acesso.', 422, 'TRANSFER_SOURCE_INVALID')
    }

    const sourcePasswordHash = transfer.sourceUser.passwordHash

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (transfer.kind === 'clinic_registration') {
        await tx.user.upsert({
          where: { clinicId_email: { clinicId: transfer.targetClinicId, email: transfer.email } },
          update: {
            name: transfer.sourceUser?.name ?? transfer.email,
            passwordHash: sourcePasswordHash,
            role: 'admin',
            active: true,
            inviteToken: null,
            inviteExpiresAt: null,
          },
          create: {
            id: transfer.targetUserId ?? generateId(),
            clinicId: transfer.targetClinicId,
            name: transfer.sourceUser?.name ?? transfer.email,
            email: transfer.email,
            passwordHash: sourcePasswordHash,
            role: 'admin',
            active: true,
          },
        })

        await tx.clinic.update({
          where: { id: transfer.targetClinicId },
          data: {
            emailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpiresAt: null,
          },
        })
      } else {
        if (transfer.targetUserId) {
          await tx.user.update({
            where: { id: transfer.targetUserId },
            data: {
              name: transfer.targetUser?.name ?? transfer.sourceUser?.name ?? transfer.email,
              email: transfer.email,
              passwordHash: sourcePasswordHash,
              role: transfer.role,
              active: true,
              inviteToken: null,
              inviteExpiresAt: null,
            },
          })
        } else {
          await tx.user.create({
            data: {
              id: generateId(),
              clinicId: transfer.targetClinicId,
              name: transfer.sourceUser?.name ?? transfer.email,
              email: transfer.email,
              passwordHash: sourcePasswordHash,
              role: transfer.role,
              active: true,
            },
          })
        }
      }

      if (transfer.sourceUserId) {
        await tx.user.update({
          where: { id: transfer.sourceUserId },
          data: { active: false },
        })
      }

      await tx.transferToken.update({
        where: { id: transfer.id },
        data: { status: 'confirmed' },
      })
    })

    return {
      message: 'Transferência confirmada com sucesso.',
      clinicSlug: transfer.targetClinic.slug,
    }
  }

  async rejectTransfer(token: string) {
    const transfer = await authRepository.findTransferByToken(token)
    if (!transfer) {
      throw new NotFoundError('Transfer token')
    }

    if (transfer.status !== 'pending') {
      throw new ForbiddenError('Esta transferência não está mais pendente.')
    }

    if (transfer.expiresAt < new Date()) {
      await prisma.transferToken.update({
        where: { id: transfer.id },
        data: { status: 'expired' },
      })
      throw new ForbiddenError('O link de transferência expirou.')
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.transferToken.update({
        where: { id: transfer.id },
        data: { status: 'rejected' },
      })

      if (transfer.kind === 'user_invite' && transfer.targetUserId && transfer.targetUser && !transfer.targetUser.active) {
        await tx.user.delete({ where: { id: transfer.targetUserId } })
      }
    })

    if (transfer.kind === 'clinic_registration') {
      await this.notifyPendingClinicWithoutAdmin(transfer.targetClinicId, transfer.targetClinic.name)
    }

    return { message: 'Transferência recusada com sucesso.' }
  }

  // ── Refresh ──────────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    const hash = hashRefreshToken(rawRefreshToken)
    const key = refreshKey(hash)

    const stored = await redis.getdel(key)
    if (!stored) {
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    const { userId, clinicId, role } = JSON.parse(stored) as {
      userId: string
      clinicId: string
      role: 'admin' | 'staff' | 'professional'
    }

    // Rotate: old token already revoked atomically via GETDEL above

    // Fetch current screenPermissions from DB to include in the new token.
    // Note: for professional tokens, screenPermissions is not applicable.
    let screenPermissions: string[] = []
    if (role === 'staff') {
      const { prisma } = await import('../../database/prisma/client')
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { screenPermissions: true },
      })
      screenPermissions = user?.screenPermissions ?? []
    }

    return this.issueTokens(userId, clinicId, role, screenPermissions)
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string): Promise<void> {
    const hash = hashRefreshToken(rawRefreshToken)
    await redis.del(refreshKey(hash))
  }

  // ── Professional login ───────────────────────────────────────────────────────

  async professionalLogin(clinicId: string, dto: ProfessionalLoginDto) {
    const professional = await authRepository.findProfessionalByEmail(clinicId, dto.email)

    if (!professional || !professional.auth) {
      throw new UnauthorizedError('Invalid email or password')
    }

    if (!professional.active) {
      throw new ForbiddenError('Professional account is inactive')
    }

    if (
      professional.auth.lockedUntil &&
      professional.auth.lockedUntil > new Date()
    ) {
      throw new ForbiddenError('Too many failed attempts. Try again later.')
    }

    await checkLockout(professional.id)

    const valid = await bcrypt.compare(dto.password, professional.auth.passwordHash)
    if (!valid) {
      await recordFailedAttempt(professional.id)
      throw new UnauthorizedError('Invalid email or password')
    }

    await clearLockout(professional.id)

    const tokens = await this.issueTokens(professional.id, professional.clinicId, 'professional')

    return {
      professional: {
        id: professional.id,
        name: professional.name,
        email: professional.email,
        role: 'professional' as const,
      },
      ...tokens,
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private async issueTokens(
    userId: string,
    clinicId: string,
    role: 'admin' | 'staff' | 'professional',
    screenPermissions: string[] = [],
  ) {
    const accessToken = this.app.jwt.sign(
      // v1 limitation: when an admin changes a user's screenPermissions, the current
      // JWT keeps the old permissions until the next login (no forced invalidation).
      { clinicId, role, screenPermissions },
      { sub: userId, expiresIn: appConfig.jwt.expiresIn },
    )

    const rawRefresh = crypto.randomBytes(48).toString('hex')
    const hash = hashRefreshToken(rawRefresh)

    await redis.setex(
      refreshKey(hash),
      REFRESH_TOKEN_TTL_SECONDS,
      JSON.stringify({ userId, clinicId, role }),
    )

    return { accessToken, refreshToken: rawRefresh }
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base
    let attempt = 0

    while (true) {
      const existing = await authRepository.findClinicBySlug(slug)
      if (!existing) return slug
      attempt++
      slug = `${base}-${attempt}`
    }
  }

  private async findAdminUser(clinicId: string) {
    return authRepository.findAdminUserByClinic(clinicId)
  }

  private async sendWelcomeEmail(params: {
    clinicId: string
    email: string
    adminName: string
    clinicName: string
    slug: string
    verificationToken: string
  }) {
    const verifyUrl = `${appConfig.frontendUrl}/verify-email?token=${params.verificationToken}`
    const greeting = params.adminName
      ? `<p>Olá, <strong>${params.adminName}</strong>!</p>`
      : '<p>Olá!</p>'
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px 16px;color:#111">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h1 style="font-size:22px;font-weight:600;margin-bottom:4px">Bem-vindo(a) ao Aesthera! 🎉</h1>
    <p style="color:#6b7280;margin-top:0">Gestão para Clínicas de Estética</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
    ${greeting}
    <p>Sua clínica <strong>${params.clinicName}</strong> foi cadastrada com sucesso.</p>
    <p style="margin-bottom:4px"><strong>Seu identificador de acesso:</strong></p>
    <code style="display:inline-block;background:#f3f4f6;border-radius:6px;padding:6px 12px;font-size:16px;font-weight:700;color:#111">${params.slug}</code>
    <p style="margin-top:16px">Para acessar o painel, você precisará deste identificador junto com seu e-mail e senha.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
    <p><strong>Confirme seu e-mail para ativar sua conta:</strong></p>
    <a href="${verifyUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Confirmar e-mail</a>
    <p style="margin-top:16px;font-size:12px;color:#9ca3af">
      Ou acesse: <a href="${verifyUrl}" style="color:#7c3aed">${verifyUrl}</a><br />
      Este link expira em 24 horas.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
    <p style="font-size:12px;color:#9ca3af">Se você não criou esta conta, ignore este e-mail.</p>
  </div>
</body>
</html>`

    try {
      await this.notifications.sendEmail({
        clinicId: params.clinicId,
        email: params.email,
        subject: `Bem-vindo ao Aesthera — confirme seu e-mail`,
        htmlBody: html,
        event: 'clinic_registration',
      })
    } catch (err) {
      logger.error({ err, email: params.email }, 'Failed to send welcome email')
    }
  }

  private async sendTransferEmail(params: {
    clinicId: string
    email: string
    sourceClinicName: string
    targetClinicName: string
    token: string
    isAdminTransfer?: boolean
  }) {
    const confirmUrl = `${appConfig.frontendUrl}/transfer/confirm?token=${params.token}&action=confirm`
    const rejectUrl = `${appConfig.frontendUrl}/transfer/confirm?token=${params.token}&action=reject`
    const html = buildTransferEmailHtml({
      sourceClinicName: params.sourceClinicName,
      targetClinicName: params.targetClinicName,
      confirmUrl,
      rejectUrl,
      isAdminTransfer: params.isAdminTransfer,
    })

    try {
      await this.notifications.sendEmail({
        clinicId: params.clinicId,
        email: params.email,
        subject: `${companyConfig.name}: confirme a transferência do seu acesso`,
        htmlBody: html,
        event: 'transfer_confirmation',
      })
    } catch (err) {
      logger.error({ err, email: params.email }, 'Failed to send transfer confirmation email')
    }
  }

  private async sendRecoverAccessEmail(params: {
    clinicId: string
    email: string
    resetUrl: string
  }) {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px 16px;color:#111">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h1 style="font-size:22px;font-weight:600;margin-bottom:4px">Recuperação de acesso</h1>
    <p style="color:#6b7280;margin-top:0">Aesthera — Gestão para Clínicas de Estética</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
    <p>Recebemos uma solicitação de recuperação de acesso para este endereço de e-mail.</p>
    <p>Clique no botão abaixo para criar uma nova senha:</p>
    <a href="${params.resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Criar nova senha</a>
    <p style="margin-top:16px;font-size:12px;color:#9ca3af">
      Ou acesse: <a href="${params.resetUrl}" style="color:#7c3aed">${params.resetUrl}</a><br />
      Este link expira em 1 hora.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
    <p style="font-size:12px;color:#9ca3af">Se você não solicitou esta recuperação, ignore este e-mail.</p>
  </div>
</body>
</html>`

    try {
      await this.notifications.sendEmail({
        clinicId: params.clinicId,
        email: params.email,
        subject: `${companyConfig.name}: recuperação de acesso`,
        htmlBody: html,
        event: 'password_reset',
      })
    } catch (err) {
      logger.error({ err, email: params.email }, 'Failed to send recover access email')
    }
  }

  private async notifyPendingClinicWithoutAdmin(clinicId: string, clinicName: string) {
    if (!companyConfig.supportEmail) {
      logger.warn({ clinicName }, 'Rejected clinic transfer left a clinic pending admin and no support email is configured')
      return
    }

    try {
      await this.notifications.sendEmail({
        clinicId,
        email: companyConfig.supportEmail,
        subject: `${companyConfig.name}: clínica sem admin após rejeição de transferência`,
        htmlBody: `<p>A clínica <strong>${clinicName}</strong> ficou sem administrador após a rejeição de uma transferência.</p>`,
        event: 'transfer_rejected_support',
      })
    } catch (err) {
      logger.error({ err, clinicName }, 'Failed to notify support about pending clinic without admin')
    }
  }
}
