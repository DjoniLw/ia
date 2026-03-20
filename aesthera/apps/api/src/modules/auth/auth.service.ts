import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { appConfig } from '../../config/app.config'
import { redis } from '../../database/redis/client'
import { logger } from '../../shared/logger/logger'
import {
  AppError,
  ConflictError,
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
    const existing = await authRepository.findClinicByEmail(dto.email)
    if (existing?.emailVerified) {
      throw new ConflictError('An account with this email already exists')
    }

    // Verify Redis is reachable before writing anything to the database.
    // If Redis is unavailable, token issuance would fail AFTER the clinic is
    // created, leaving a half-created record the user could never log into.
    // Failing here (before any DB write) lets the user retry cleanly.
    try {
      await redis.ping()
    } catch {
      throw new AppError(
        'Authentication service is temporarily unavailable. Please try again later.',
        503,
        'SERVICE_UNAVAILABLE',
      )
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)

    let clinic: { id: string; slug: string; name: string }
    let clinicId: string
    let adminId: string

    if (existing && !existing.emailVerified) {
      // Account exists but was never verified — allow the user to "re-register":
      // refresh the verification token and update their data.
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
      clinic = await authRepository.updateUnverifiedClinicForReRegistration({
        clinicId: existing.id,
        name: dto.clinicName,
        phone: dto.phone,
        document: dto.clinicDocument,
        adminName: dto.adminName,
        passwordHash,
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      })
      clinicId = existing.id
      const adminUser = await authRepository.findAdminUserByClinic(existing.id)
      adminId = adminUser?.id ?? existing.id
    } else {
      // Fresh registration
      const baseSlug = slugify(dto.clinicName)
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
        document: dto.clinicDocument,
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
    const clinic = await authRepository.findClinicByEmail(email)

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

    const tokens = await this.issueTokens(user.id, user.clinicId, user.role)

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    }
  }

  // ── Refresh ──────────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    const hash = hashRefreshToken(rawRefreshToken)
    const key = refreshKey(hash)

    const stored = await redis.get(key)
    if (!stored) {
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    const { userId, clinicId, role } = JSON.parse(stored) as {
      userId: string
      clinicId: string
      role: 'admin' | 'staff' | 'professional'
    }

    // Rotate: revoke old token
    await redis.del(key)

    return this.issueTokens(userId, clinicId, role)
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
  ) {
    const accessToken = this.app.jwt.sign(
      { clinicId, role },
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
}
