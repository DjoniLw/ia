import { prisma } from '../../database/prisma/client'
import { ConflictError, UnauthorizedError } from '../../shared/errors/app-error'
import { generateId } from '../../shared/utils/id'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { appConfig } from '../../config/app.config'

interface JwtPayload {
  companyId: string
  iat: number
  exp: number
}

export class AuthService {
  async register(name: string, email: string, document: string, password: string) {
    // Check if company already exists
    const existing = await prisma.company.findUnique({
      where: { email },
    })

    if (existing) {
      throw new ConflictError('Company with this email already exists')
    }

    // Hash password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

    // Create company + auth
    const company = await prisma.company.create({
      data: {
        id: generateId(),
        name,
        email,
        document,
        auth: {
          create: {
            id: generateId(),
            passwordHash,
          },
        },
      },
    })

    const tokens = this.generateTokens(company.id)

    return {
      companyId: company.id,
      email: company.email,
      tokens,
    }
  }

  async login(email: string, password: string) {
    const company = await prisma.company.findUnique({
      where: { email },
      include: { auth: true },
    })

    if (!company || !company.auth) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

    if (company.auth.passwordHash !== passwordHash) {
      // Increment failed attempts
      await prisma.companyAuth.update({
        where: { companyId: company.id },
        data: { failedAttempts: { increment: 1 } },
      })

      throw new UnauthorizedError('Invalid credentials')
    }

    // Reset failed attempts on successful login
    await prisma.companyAuth.update({
      where: { companyId: company.id },
      data: { failedAttempts: 0 },
    })

    const tokens = this.generateTokens(company.id)

    return {
      companyId: company.id,
      email: company.email,
      tokens,
    }
  }

  async refreshToken(token: string) {
    try {
      const payload = jwt.verify(token, appConfig.jwt.refreshSecret) as JwtPayload

      return this.generateTokens(payload.companyId)
    } catch {
      throw new UnauthorizedError('Invalid refresh token')
    }
  }

  private generateTokens(companyId: string) {
    const payload = { companyId }

    return {
      accessToken: jwt.sign(payload, appConfig.jwt.secret, {
        expiresIn: appConfig.jwt.expiresIn as jwt.SignOptions['expiresIn'],
        subject: companyId,
      }),
      refreshToken: jwt.sign(payload, appConfig.jwt.refreshSecret, {
        expiresIn: appConfig.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
        subject: companyId,
      }),
    }
  }
}

export const authService = new AuthService()
