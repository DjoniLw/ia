import { FastifyInstance } from 'fastify'
import { paymentsController } from './payments.controller'
import { jwtGuard } from '../../shared/guards/jwt.guard'
import { ListPaymentsDto } from './payments.dto'

export async function paymentsRoutes(app: FastifyInstance) {
  // Protected routes — require JWT
  app.get<{ Querystring: ListPaymentsDto }>(
    '/payments',
    { onRequest: jwtGuard },
    async (request, reply) => {
      const validated = ListPaymentsDto.parse(request.query)
      request.query = validated
      await paymentsController.list(request, reply)
    },
  )

  app.get<{ Params: { id: string } }>(
    '/payments/:id',
    { onRequest: jwtGuard },
    async (request, reply) => {
      await paymentsController.getById(request, reply)
    },
  )

  // Public webhook routes — signature verified in controller
  app.post('/payments/webhooks/stripe', async (request, reply) => {
    await paymentsController.handleStripeWebhook(request, reply)
  })

  app.post('/payments/webhooks/mercadopago', async (request, reply) => {
    await paymentsController.handleMercadoPagoWebhook(request, reply)
  })
}
