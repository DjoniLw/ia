import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAppConfig = vi.hoisted(() => ({
  stripe: { webhookSecret: 'whsec_test_stripe' },
  mercadopago: { webhookSecret: 'whsec_test_mp' },
}))

vi.mock('../../config/app.config', () => ({
  appConfig: mockAppConfig,
}))

vi.mock('../../database/prisma/client', () => ({
  prisma: {
    billing: { findUnique: vi.fn(), update: vi.fn() },
    payment: { findFirst: vi.fn() },
  },
}))

vi.mock('./payments.repository', () => ({
  PaymentsRepository: vi.fn(function PaymentsRepository() {
    return {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      findByGatewayId: vi.fn(),
      updateStatus: vi.fn(),
    }
  }),
}))

vi.mock('../../shared/events/event-bus', () => ({
  eventBus: { publish: vi.fn() },
}))

vi.mock('../../shared/events/domain-event', () => ({
  createDomainEvent: vi.fn(),
}))

import { createHmac } from 'node:crypto'
import { PaymentsService } from './payments.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildStripeSignature(rawBody: Buffer, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signed = `${timestamp}.${rawBody.toString('utf-8')}`
  const hmac = createHmac('sha256', secret).update(signed).digest('hex')
  return `t=${timestamp},v1=${hmac}`
}

function buildMercadoPagoSignature(
  rawBody: Buffer,
  secret: string,
  requestId: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  let dataId = ''
  try {
    const body = JSON.parse(rawBody.toString('utf-8')) as { data?: { id?: unknown } }
    dataId = String(body?.data?.id ?? '')
  } catch {
    // ignore
  }
  const signed = `id:${dataId};request-id:${requestId};ts:${timestamp};`
  const hmac = createHmac('sha256', secret).update(signed).digest('hex')
  return `ts=${timestamp},v1=${hmac}`
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('PaymentsService.handleStripeWebhook()', () => {
  let service: PaymentsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PaymentsService()
  })

  it('deve aceitar webhook Stripe com assinatura válida', async () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }))
    const sig = buildStripeSignature(rawBody, 'whsec_test_stripe')
    await expect(service.handleStripeWebhook(rawBody, sig)).resolves.toEqual({ received: true })
  })

  it('deve rejeitar webhook Stripe com assinatura inválida (400 INVALID_SIGNATURE)', async () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }))
    await expect(service.handleStripeWebhook(rawBody, 'sig-invalida')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_SIGNATURE',
    })
  })

  it('deve retornar 503 quando STRIPE_WEBHOOK_SECRET não está configurado', async () => {
    mockAppConfig.stripe.webhookSecret = undefined as unknown as string
    const rawBody = Buffer.from('{}')
    await expect(service.handleStripeWebhook(rawBody, 'qualquer')).rejects.toMatchObject({
      statusCode: 503,
      code: 'WEBHOOK_NOT_CONFIGURED',
    })
    // Restaura
    mockAppConfig.stripe.webhookSecret = 'whsec_test_stripe'
  })
})

describe('PaymentsService.handleMercadoPagoWebhook()', () => {
  let service: PaymentsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PaymentsService()
  })

  it('deve aceitar webhook MercadoPago com assinatura válida', async () => {
    const rawBody = Buffer.from(JSON.stringify({ data: { id: 'pay_abc123' } }))
    const requestId = 'req-uuid-001'
    const sig = buildMercadoPagoSignature(rawBody, 'whsec_test_mp', requestId)
    await expect(
      service.handleMercadoPagoWebhook(rawBody, sig, requestId),
    ).resolves.toEqual({ received: true })
  })

  it('deve rejeitar webhook MercadoPago com assinatura inválida (400 INVALID_SIGNATURE)', async () => {
    const rawBody = Buffer.from(JSON.stringify({ data: { id: 'pay_abc123' } }))
    await expect(
      service.handleMercadoPagoWebhook(rawBody, 'sig-invalida', 'req-id'),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_SIGNATURE',
    })
  })

  it('deve retornar 503 quando MP_WEBHOOK_SECRET não está configurado', async () => {
    mockAppConfig.mercadopago.webhookSecret = undefined as unknown as string
    const rawBody = Buffer.from('{}')
    await expect(
      service.handleMercadoPagoWebhook(rawBody, 'qualquer', 'req-id'),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'WEBHOOK_NOT_CONFIGURED',
    })
    // Restaura
    mockAppConfig.mercadopago.webhookSecret = 'whsec_test_mp'
  })
})
