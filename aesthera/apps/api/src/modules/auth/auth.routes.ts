import type { FastifyInstance } from 'fastify'
import { AuthService } from './auth.service'
import {
  RegisterClinicDto,
  LoginDto,
  RefreshTokenDto,
  ProfessionalLoginDto,
} from './auth.dto'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(app)

  // ── POST /auth/register ─────────────────────────────────────────────────────
  // Creates a new clinic + first admin user. PUBLIC — no tenant, no auth.
  app.post('/auth/register', async (request, reply) => {
    const body = RegisterClinicDto.parse(request.body)
    const result = await authService.registerClinic(body)
    reply.status(201).send(result)
  })

  // ── POST /auth/login ────────────────────────────────────────────────────────
  // Requires X-Clinic-Slug header (sent by frontend from subdomain).
  app.post('/auth/login', { preHandler: [] }, async (request, reply) => {
    const body = LoginDto.parse(request.body)
    const result = await authService.login(request.clinicId, body)
    reply.status(200).send(result)
  })

  // ── POST /auth/refresh ──────────────────────────────────────────────────────
  // Rotates access + refresh tokens. PUBLIC — no tenant, no auth.
  app.post('/auth/refresh', async (request, reply) => {
    const body = RefreshTokenDto.parse(request.body)
    const tokens = await authService.refresh(body.refreshToken)
    reply.status(200).send(tokens)
  })

  // ── POST /auth/logout ───────────────────────────────────────────────────────
  // Revokes refresh token from Redis.
  app.post(
    '/auth/logout',
    { preHandler: [jwtClinicGuard] },
    async (request, reply) => {
      const body = RefreshTokenDto.parse(request.body)
      await authService.logout(body.refreshToken)
      reply.status(200).send({ message: 'Logged out successfully' })
    },
  )

  // ── Professional auth ───────────────────────────────────────────────────────

  // POST /auth/professional/login — requires X-Clinic-Slug
  app.post(
    '/auth/professional/login',
    { preHandler: [] },
    async (request, reply) => {
      const body = ProfessionalLoginDto.parse(request.body)
      const result = await authService.professionalLogin(request.clinicId, body)
      reply.status(200).send(result)
    },
  )
}
