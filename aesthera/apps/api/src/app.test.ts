import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// ── Mocks de infraestrutura (necessários para buildApp()) ────────────────────

vi.mock('./config/app.config', () => ({
  appConfig: {
    isProduction: false,
    isTest: true,
    env: 'test',
    port: 3001,
    cors: { origin: false },
    jwt: { secret: 'test-secret-key-for-jest-32-chars!!', expiresIn: '1h', refreshExpiresIn: '7d' },
    db: { url: 'postgresql://placeholder:test@localhost:5432/test' },
    redis: { url: 'redis://localhost:6379' },
    stripe: { secretKey: '', webhookSecret: '' },
    mercadopago: { accessToken: '', webhookSecret: '' },
    email: { apiKey: '', from: 'test@test.com' },
    whatsapp: { instanceId: '', token: '', clientToken: '' },
    ai: { geminiApiKey: '', geminiModel: 'gemini-test' },
    frontendUrl: 'http://localhost:3001',
  },
}))

vi.mock('./database/redis/client', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('./database/prisma/client', () => ({ prisma: {} }))

vi.mock('./domain-event-handlers', () => ({}))

vi.mock('./shared/logger/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// ── Mock do tenantMiddleware — espião para verificar se foi acionado ──────────

const mockTenantMiddleware = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('./shared/middleware/tenant.middleware', () => ({
  tenantMiddleware: mockTenantMiddleware,
}))

// ── Mocks dos módulos de rotas ────────────────────────────────────────────────
// Apenas as rotas necessárias para o teste são registradas como stubs.
// As demais são substituídas por vi.fn() (não registram nenhuma rota).

vi.mock('./modules/auth/auth.routes', () => ({
  authRoutes: async (app: FastifyInstance) => {
    // Rotas adicionadas ao PUBLIC_ROUTES no PR #115
    app.post('/auth/resolve-slug', async () => ({ ok: true }))
    app.post('/auth/reset-password', async () => ({ ok: true }))
    app.post('/auth/resend-verification', async () => ({ ok: true }))
    app.post('/auth/resend-transfer', async () => ({ ok: true }))
    app.post('/auth/confirm-transfer', async () => ({ ok: true }))
    app.post('/auth/reject-transfer', async () => ({ ok: true }))
    // Rotas públicas preexistentes (controle)
    app.post('/auth/register', async () => ({ ok: true }))
    app.post('/auth/login', async () => ({ ok: true }))
    app.get('/auth/refresh', async () => ({ ok: true }))
  },
}))

vi.mock('./modules/clinics/clinics.routes', () => ({
  clinicsRoutes: async (app: FastifyInstance) => {
    // Rota protegida — usada como controle para garantir que tenantMiddleware é acionado
    app.get('/clinics', async () => ({ ok: true }))
  },
}))

// Os demais módulos não precisam registrar rotas para este teste
vi.mock('./modules/customers/customers.routes', () => ({ customersRoutes: vi.fn() }))
vi.mock('./modules/professionals/professionals.routes', () => ({ professionalsRoutes: vi.fn() }))
vi.mock('./modules/services/services.routes', () => ({ servicesRoutes: vi.fn() }))
vi.mock('./modules/users/users.routes', () => ({ usersRoutes: vi.fn() }))
vi.mock('./modules/appointments/appointments.routes', () => ({ appointmentsRoutes: vi.fn() }))
vi.mock('./modules/billing/billing.routes', () => ({ billingRoutes: vi.fn() }))
vi.mock('./modules/payments/payments.routes', () => ({ paymentsRoutes: vi.fn() }))
vi.mock('./modules/ledger/ledger.routes', () => ({ ledgerRoutes: vi.fn() }))
vi.mock('./modules/notifications/notifications.routes', () => ({ notificationsRoutes: vi.fn() }))
vi.mock('./modules/ai/ai.routes', () => ({ aiRoutes: vi.fn() }))
vi.mock('./modules/products/products.routes', () => ({ productsRoutes: vi.fn() }))
vi.mock('./modules/clinical/clinical.routes', () => ({ clinicalRoutes: vi.fn() }))
vi.mock('./modules/equipment/equipment.routes', () => ({ equipmentRoutes: vi.fn() }))
vi.mock('./modules/rooms/rooms.routes', () => ({ roomsRoutes: vi.fn() }))
vi.mock('./modules/supplies/supplies.routes', () => ({ suppliesRoutes: vi.fn() }))
vi.mock('./modules/supply-purchases/supply-purchases.routes', () => ({ supplyPurchasesRoutes: vi.fn() }))
vi.mock('./modules/wallet/wallet.routes', () => ({ walletRoutes: vi.fn() }))
vi.mock('./modules/promotions/promotions.routes', () => ({ promotionsRoutes: vi.fn() }))
vi.mock('./modules/packages/packages.routes', () => ({ packagesRoutes: vi.fn() }))
vi.mock('./modules/accounts-payable/accounts-payable.routes', () => ({ accountsPayableRoutes: vi.fn() }))
vi.mock('./modules/manual-receipts/manual-receipts.routes', () => ({ manualReceiptsRoutes: vi.fn() }))

import { buildApp } from './app'

// ── Testes ────────────────────────────────────────────────────────────────────

/**
 * Testes de regressão para o hook PUBLIC_ROUTES em app.ts.
 *
 * O bug corrigido no PR #115: rotas que não dependem de X-Clinic-Slug estavam
 * ausentes do Set PUBLIC_ROUTES, fazendo o tenantMiddleware rejeitar com 400
 * MISSING_TENANT — impedindo fluxos de login após limpeza de cache.
 *
 * Este teste garante que:
 * 1. As rotas públicas NÃO acionam tenantMiddleware (sem exigir X-Clinic-Slug)
 * 2. Rotas protegidas CONTINUAM acionando tenantMiddleware (contrato preservado)
 */
describe('buildApp — PUBLIC_ROUTES: bypass do tenantMiddleware (regressão PR #115)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Rotas adicionadas no PR #115 ──────────────────────────────────────────

  it('POST /auth/resolve-slug sem X-Clinic-Slug não deve acionar tenantMiddleware', async () => {
    await app.inject({ method: 'POST', url: '/auth/resolve-slug', payload: {} })
    expect(mockTenantMiddleware).not.toHaveBeenCalled()
  })

  it('POST /auth/reset-password sem X-Clinic-Slug não deve acionar tenantMiddleware', async () => {
    await app.inject({ method: 'POST', url: '/auth/reset-password', payload: {} })
    expect(mockTenantMiddleware).not.toHaveBeenCalled()
  })

  it('POST /auth/resend-verification sem X-Clinic-Slug não deve acionar tenantMiddleware', async () => {
    await app.inject({ method: 'POST', url: '/auth/resend-verification', payload: {} })
    expect(mockTenantMiddleware).not.toHaveBeenCalled()
  })

  it('POST /auth/resend-transfer sem X-Clinic-Slug não deve acionar tenantMiddleware', async () => {
    await app.inject({ method: 'POST', url: '/auth/resend-transfer', payload: {} })
    expect(mockTenantMiddleware).not.toHaveBeenCalled()
  })

  it('POST /auth/confirm-transfer sem X-Clinic-Slug não deve acionar tenantMiddleware', async () => {
    await app.inject({ method: 'POST', url: '/auth/confirm-transfer', payload: {} })
    expect(mockTenantMiddleware).not.toHaveBeenCalled()
  })

  it('POST /auth/reject-transfer sem X-Clinic-Slug não deve acionar tenantMiddleware', async () => {
    await app.inject({ method: 'POST', url: '/auth/reject-transfer', payload: {} })
    expect(mockTenantMiddleware).not.toHaveBeenCalled()
  })

  // ── Rotas públicas preexistentes (controle) ───────────────────────────────

  it('GET /health sem X-Clinic-Slug não deve acionar tenantMiddleware', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(mockTenantMiddleware).not.toHaveBeenCalled()
  })

  it('POST /auth/register sem X-Clinic-Slug não deve acionar tenantMiddleware', async () => {
    await app.inject({ method: 'POST', url: '/auth/register', payload: {} })
    expect(mockTenantMiddleware).not.toHaveBeenCalled()
  })

  // ── Rota protegida — garante que tenantMiddleware continua sendo acionado ──

  it('GET /clinics sem X-Clinic-Slug deve acionar tenantMiddleware (rota protegida)', async () => {
    await app.inject({ method: 'GET', url: '/clinics' })
    expect(mockTenantMiddleware).toHaveBeenCalledOnce()
  })
})
