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
  app.post('/payments/webhooks/stripe', async (req, reply) => {
    const sig = (req.headers['stripe-signature'] as string) ?? ''
    await svc.handleStripeWebhook(JSON.stringify(req.body), sig)
    return reply.send({ received: true })
  })

  app.post('/payments/webhooks/mercadopago', async (req, reply) => {
    const sig = (req.headers['x-signature'] as string) ?? ''
    await svc.handleMercadoPagoWebhook(JSON.stringify(req.body), sig)
    return reply.send({ received: true })
  })
}
