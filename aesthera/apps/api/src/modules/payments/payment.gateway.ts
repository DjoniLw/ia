/**
 * Payment Gateway abstraction.
 * Real implementations (Stripe, MercadoPago) plug in here.
 * MockGateway is used when no credentials are configured.
 */

export interface CreatePaymentIntentInput {
  billingId: string
  customerId: string
  amount: number // BRL cents
  method: 'pix' | 'boleto' | 'card'
  dueDate: Date
  description: string
  metadata?: Record<string, unknown>
}

export interface PaymentIntentResult {
  gatewayPaymentId: string
  paymentUrl: string
  pixQrCode?: string
  expiresAt?: Date
}

export interface PaymentGateway {
  name: 'stripe' | 'mercadopago' | 'mock'
  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>
  verifyWebhookSignature(payload: string, signature: string): boolean
}

// ── Mock gateway (dev / no credentials) ──────────────────────────────────────

export class MockGateway implements PaymentGateway {
  name: 'mock' = 'mock'

  async createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const id = `mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + (input.method === 'pix' ? 30 : 1440))

    const baseUrl = process.env.API_URL ?? 'http://localhost:3001'
    return {
      gatewayPaymentId: id,
      paymentUrl: `${baseUrl}/payments/mock/pay/${id}`,
      pixQrCode: input.method === 'pix' ? `00020126${id}` : undefined,
      expiresAt,
    }
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return true // Mock always valid
  }
}

// ── Stub Stripe gateway (needs STRIPE_SECRET_KEY) ─────────────────────────────
export class StripeGateway implements PaymentGateway {
  name: 'stripe' = 'stripe'
  // Swap in real Stripe SDK when STRIPE_SECRET_KEY is configured
  async createIntent(_input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    throw new Error('Stripe credentials not configured')
  }
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return false
  }
}

// ── Stub MercadoPago gateway (needs MP_ACCESS_TOKEN) ─────────────────────────
export class MercadoPagoGateway implements PaymentGateway {
  name: 'mercadopago' = 'mercadopago'
  async createIntent(_input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    throw new Error('MercadoPago credentials not configured')
  }
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return false
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createGateway(method: 'pix' | 'boleto' | 'card'): PaymentGateway {
  const { STRIPE_SECRET_KEY, MP_ACCESS_TOKEN } = process.env
  if (method === 'card' && STRIPE_SECRET_KEY) return new StripeGateway()
  if ((method === 'pix' || method === 'boleto') && MP_ACCESS_TOKEN) return new MercadoPagoGateway()
  return new MockGateway()
}
