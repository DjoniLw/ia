import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAppConfig = vi.hoisted(() => ({
  stripe: { webhookSecret: 'whsec_test_stripe' },
  mercadopago: { webhookSecret: 'whsec_test_mp' },
}))

vi.mock('../../config/app.config', () => ({
  appConfig: mockAppConfig,
}))

import { StripeGateway } from './payment.gateway'

function buildStripeSignature(rawBody: Buffer, secret: string, timestampOverride?: number): string {
  const timestamp = (timestampOverride ?? Math.floor(Date.now() / 1000)).toString()
  const signed = `${timestamp}.${rawBody.toString('utf-8')}`
  const hmac = createHmac('sha256', secret).update(signed).digest('hex')
  return `t=${timestamp},v1=${hmac}`
}

describe('StripeGateway.verifyWebhookSignature()', () => {
  let gateway: StripeGateway

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = new StripeGateway()
  })

  it('deve aceitar webhook com assinatura e timestamp válidos', () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }))
    const sig = buildStripeSignature(rawBody, 'whsec_test_stripe')
    expect(gateway.verifyWebhookSignature(rawBody, sig)).toBe(true)
  })

  it('deve rejeitar webhook com assinatura HMAC incorreta', () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }))
    const sig = buildStripeSignature(rawBody, 'whsec_outro_secret')
    expect(gateway.verifyWebhookSignature(rawBody, sig)).toBe(false)
  })

  it('deve rejeitar payload com timestamp expirado (replay attack)', () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }))
    const expiredTimestamp = Math.floor(Date.now() / 1000) - (StripeGateway.TIMESTAMP_TOLERANCE_S + 1)
    const sig = buildStripeSignature(rawBody, 'whsec_test_stripe', expiredTimestamp)
    expect(gateway.verifyWebhookSignature(rawBody, sig)).toBe(false)
  })

  it('deve aceitar payload com timestamp no limite de tolerância (borda)', () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' }))
    const borderTimestamp = Math.floor(Date.now() / 1000) - StripeGateway.TIMESTAMP_TOLERANCE_S
    const sig = buildStripeSignature(rawBody, 'whsec_test_stripe', borderTimestamp)
    expect(gateway.verifyWebhookSignature(rawBody, sig)).toBe(true)
  })

  it('deve rejeitar quando STRIPE_WEBHOOK_SECRET não está configurado', () => {
    mockAppConfig.stripe.webhookSecret = undefined as unknown as string
    const rawBody = Buffer.from('{}')
    expect(gateway.verifyWebhookSignature(rawBody, 't=123,v1=abc')).toBe(false)
    mockAppConfig.stripe.webhookSecret = 'whsec_test_stripe'
  })

  it('deve rejeitar header de assinatura malformado', () => {
    const rawBody = Buffer.from('{}')
    expect(gateway.verifyWebhookSignature(rawBody, 'header-invalido')).toBe(false)
  })
})
