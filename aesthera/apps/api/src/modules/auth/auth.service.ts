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
} from '../../shared/errors/app-error'
import { generateId } from '../../shared/utils/id'
import { authRepository } from './auth.repository'
import type { FastifyInstance } from 'fastify'
import type { RegisterClinicDto, LoginDto, ProfessionalLoginDto } from './auth.dto'

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12
const MAX_FAILED_ATTEMPTS = 5
const LOCK_TTL_SECONDS = 900 // 15 min
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

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
  constructor(private readonly app: FastifyInstance) {}

  // ── Register ────────────────────────────────────────────────────────────────

  async registerClinic(dto: RegisterClinicDto) {
    const existing = await authRepository.findClinicByEmail(dto.email)
    if (existing) {
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

    const baseSlug = slugify(dto.clinicName)
    const slug = await this.uniqueSlug(baseSlug)
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
    const clinicId = generateId()
    const adminId = generateId()

    const clinic = await authRepository.createClinicWithAdmin({
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
    })

    const tokens = await this.issueTokens(adminId, clinic.id, 'admin')

    return {
      clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name },
      user: { id: adminId, name: dto.adminName, email: dto.email, role: 'admin' as const },
      ...tokens,
    }
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  async login(clinicId: string, dto: LoginDto) {
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
}
