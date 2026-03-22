import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { ListPaymentsQuery } from './payments.dto'
import { PaymentsService } from './payments.service'

export async function paymentsRoutes(app: FastifyInstance) {
  const svc = new PaymentsService()

  app.get('/payments', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListPaymentsQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.get('/payments/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  // ── Public: payment page data (no auth — token-based) ────────────────────────
  app.get('/pay/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    return reply.send(await svc.getBillingByToken(token))
  })

  // ── Mock gateway: confirm payment (dev only) ──────────────────────────────────
  app.post('/payments/mock/pay/:gatewayPaymentId', async (req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ message: 'Not found' })
    }
    const { gatewayPaymentId } = req.params as { gatewayPaymentId: string }
    return reply.send(await svc.confirmMockPayment(gatewayPaymentId))
  })

  // ── Webhooks (public — signature-verified internally) ────────────────────────
  // Raw body is required for HMAC signature validation (Stripe and MercadoPago
  // sign the original bytes, not the JSON-parsed representation).
  app.register(async function webhookScope(fastify) {
    fastify.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body),
    )

    fastify.post('/payments/webhooks/stripe', async (req, reply) => {
      const rawBody = req.body as Buffer
      const sig = (req.headers['stripe-signature'] as string) ?? ''
      return reply.send(await svc.handleStripeWebhook(rawBody, sig))
    })

    fastify.post('/payments/webhooks/mercadopago', async (req, reply) => {
      const rawBody = req.body as Buffer
      const sig = (req.headers['x-signature'] as string) ?? ''
      const requestId = (req.headers['x-request-id'] as string) ?? ''
      return reply.send(await svc.handleMercadoPagoWebhook(rawBody, sig, requestId))
    })
  })
}
