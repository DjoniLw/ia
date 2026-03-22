import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAppConfig = vi.hoisted(() => ({
  isProduction: false,
}))

vi.mock('../../config/app.config', () => ({
  appConfig: mockAppConfig,
}))

vi.mock('../../shared/guards/jwt-clinic.guard', () => ({
  jwtClinicGuard: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./payments.dto', () => ({
  ListPaymentsQuery: { parse: vi.fn((q) => q) },
}))

const mockSvc = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  getBillingByToken: vi.fn(),
  confirmMockPayment: vi.fn().mockResolvedValue({ success: true }),
  handleStripeWebhook: vi.fn(),
  handleMercadoPagoWebhook: vi.fn(),
}))

vi.mock('./payments.service', () => ({
  PaymentsService: vi.fn(function PaymentsService() {
    return mockSvc
  }),
}))

import { paymentsRoutes } from './payments.routes'

// ── Testes ────────────────────────────────────────────────────────────────────

describe('paymentsRoutes — endpoint mock (issue #84)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve retornar 404 quando appConfig.isProduction é true', async () => {
    mockAppConfig.isProduction = true

    const app = Fastify()
    await app.register(paymentsRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/payments/mock/pay/gateway-id-123',
    })

    expect(res.statusCode).toBe(404)
    expect(mockSvc.confirmMockPayment).not.toHaveBeenCalled()
  })

  it('deve confirmar pagamento quando appConfig.isProduction é false (dev/staging)', async () => {
    mockAppConfig.isProduction = false

    const app = Fastify()
    await app.register(paymentsRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/payments/mock/pay/gateway-id-456',
    })

    expect(res.statusCode).toBe(200)
    expect(mockSvc.confirmMockPayment).toHaveBeenCalledWith('gateway-id-456')
  })

  it('não deve usar process.env.NODE_ENV para decidir bloqueio do endpoint mock', async () => {
    // Com appConfig.isProduction = false, o endpoint deve funcionar
    // independente de NODE_ENV.
    mockAppConfig.isProduction = false
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production' // simula staging com NODE_ENV=production

    const app = Fastify()
    await app.register(paymentsRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/payments/mock/pay/gateway-id-789',
    })

    // Deve funcionar pois appConfig.isProduction = false (AMBIENTE_DEV=S)
    expect(res.statusCode).toBe(200)

    process.env.NODE_ENV = originalNodeEnv
  })
})
