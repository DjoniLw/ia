import { FastifyRequest, FastifyReply } from 'fastify'
import { paymentsService } from './payments.service'

export class PaymentsController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const query = request.query as any
    const result = await paymentsService.list(companyId, query)
    reply.send(result)
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }

    const result = await paymentsService.getById(companyId, id)
    reply.send(result)
  }

  async handleStripeWebhook(request: FastifyRequest, reply: FastifyReply) {
    const signature = request.headers['stripe-signature'] as string
    const rawBody = JSON.stringify(request.body || {})
    const body = request.body as any

    try {
      const result = await paymentsService.handleStripeWebhook(signature, rawBody, body)
      reply.status(200).send(result)
    } catch (err: any) {
      reply.status(400).send({ error: err.message })
    }
  }

  async handleMercadoPagoWebhook(request: FastifyRequest, reply: FastifyReply) {
    const signature = request.headers['x-signature'] as string
    const rawBody = JSON.stringify(request.body || {})
    const body = request.body as any

    try {
      const result = await paymentsService.handleMercadoPagoWebhook(signature, rawBody, body)
      reply.status(200).send(result)
    } catch (err: any) {
      reply.status(400).send({ error: err.message })
    }
  }
}

export const paymentsController = new PaymentsController()
