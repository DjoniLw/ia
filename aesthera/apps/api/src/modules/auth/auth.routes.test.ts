import { describe, expect, it, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./auth.service', () => ({
  AuthService: vi.fn(function AuthService() {
    return {
      resolveSlug: vi.fn().mockResolvedValue({ slug: null }),
      registerClinic: vi.fn().mockResolvedValue({ id: 'clinic-1' }),
      verifyEmail: vi.fn().mockResolvedValue({ accessToken: 'tok' }),
      resendVerification: vi.fn().mockResolvedValue({ message: 'ok' }),
      resendTransfer: vi.fn().mockResolvedValue({ message: 'ok' }),
      recoverAccess: vi.fn().mockResolvedValue({ message: 'ok' }),
      resetPassword: vi.fn().mockResolvedValue({ message: 'ok' }),
      confirmTransfer: vi.fn().mockResolvedValue({ message: 'ok' }),
      rejectTransfer: vi.fn().mockResolvedValue({ message: 'ok' }),
      login: vi.fn().mockResolvedValue({ accessToken: 'tok' }),
      refresh: vi.fn().mockResolvedValue({ accessToken: 'tok' }),
      logout: vi.fn().mockResolvedValue(undefined),
      professionalLogin: vi.fn().mockResolvedValue({ accessToken: 'tok' }),
    }
  }),
}))

vi.mock('./auth.dto', () => ({
  RegisterClinicDto: { parse: vi.fn((b) => b) },
  LoginDto: { parse: vi.fn((b) => b) },
  RefreshTokenDto: { parse: vi.fn((b) => b) },
  ProfessionalLoginDto: { parse: vi.fn((b) => b) },
  TransferTokenActionDto: { parse: vi.fn((b) => b) },
  VerifyEmailDto: { parse: vi.fn((b) => b) },
  ResendVerificationDto: { parse: vi.fn((b) => b) },
  ResendTransferDto: { parse: vi.fn((b) => b) },
  RecoverAccessDto: { parse: vi.fn((b) => b) },
  ResetPasswordDto: { parse: vi.fn((b) => b) },
}))

import { authRoutes } from './auth.routes'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify({ logger: false })

  // Rate limit com Redis em memória para teste
  await app.register(rateLimit, {
    global: false, // apenas rotas com config.rateLimit recebem o limite
  })

  app.decorateRequest('clinicId', '')

  await app.register(authRoutes)
  await app.ready()
  return app
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('authRoutes — rate limiting sensível (issue #85)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve bloquear com 429 após 5 requisições a /auth/recover-access em 15 minutos', async () => {
    const app = await buildApp()

    const body = { email: 'teste@clinica.com.br' }

    // 5 requisições devem passar
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'POST', url: '/auth/recover-access', payload: body })
      expect(res.statusCode).toBe(200)
    }

    // A 6ª deve ser bloqueada
    const blocked = await app.inject({ method: 'POST', url: '/auth/recover-access', payload: body })
    expect(blocked.statusCode).toBe(429)
  })

  it('deve bloquear com 429 após 10 requisições a /auth/login em 1 minuto', async () => {
    const app = await buildApp()

    const body = { email: 'admin@clinica.com.br', password: 'Senha123!' }

    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ method: 'POST', url: '/auth/login', payload: body })
      expect(res.statusCode).toBe(200)
    }

    const blocked = await app.inject({ method: 'POST', url: '/auth/login', payload: body })
    expect(blocked.statusCode).toBe(429)
  })

  it('deve bloquear com 429 após 3 requisições a /auth/resend-verification em 15 minutos', async () => {
    const app = await buildApp()

    const body = { email: 'novo@clinica.com.br' }

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'POST', url: '/auth/resend-verification', payload: body })
      expect(res.statusCode).toBe(200)
    }

    const blocked = await app.inject({ method: 'POST', url: '/auth/resend-verification', payload: body })
    expect(blocked.statusCode).toBe(429)
  })

  it('deve bloquear com 429 após 5 requisições a /auth/register em 1 hora', async () => {
    const app = await buildApp()

    const body = { clinicName: 'Clínica Teste', email: 'admin@nova.com.br', password: 'Senha123!' }

    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'POST', url: '/auth/register', payload: body })
      expect(res.statusCode).toBe(201)
    }

    const blocked = await app.inject({ method: 'POST', url: '/auth/register', payload: body })
    expect(blocked.statusCode).toBe(429)
  })

  it('rate limits por rota são independentes — bloquear login não afeta recover-access', async () => {
    const app = await buildApp()

    // Esgota o limite de login (10)
    for (let i = 0; i < 11; i++) {
      await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'x@x.com', password: 'p' } })
    }

    // recover-access ainda deve funcionar (limit independente)
    const res = await app.inject({ method: 'POST', url: '/auth/recover-access', payload: { email: 'x@x.com' } })
    expect(res.statusCode).toBe(200)
  })
})
