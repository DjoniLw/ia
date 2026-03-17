import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { CancelBillingDto, ListBillingQuery, ReceivePaymentDto } from './billing.dto'
import { BillingService } from './billing.service'

export async function billingRoutes(app: FastifyInstance) {
  const svc = new BillingService()

  app.get('/billing', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListBillingQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.get('/billing/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  app.get('/billing/:id/payment-link', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.getPaymentLink(req.clinicId, id))
  })

  app.post(
    '/billing/:id/cancel',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = CancelBillingDto.parse(req.body ?? {})
      return reply.send(await svc.cancel(req.clinicId, id, dto))
    },
  )

  app.post(
    '/billing/:id/mark-paid',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.markPaid(req.clinicId, id))
    },
  )

  app.post(
    '/billing/:id/receive-payment',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = ReceivePaymentDto.parse(req.body)
      return reply.send(await svc.receivePayment(req.clinicId, id, dto))
    },
  )

  // Internal cron endpoint (protected — production would be a cronjob, not HTTP)
  app.post(
    '/billing/cron/overdue',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (_req, reply) => {
      return reply.send(await svc.runOverdueCron())
    },
  )
}
