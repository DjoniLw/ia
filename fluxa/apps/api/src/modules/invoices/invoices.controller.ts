import { FastifyRequest, FastifyReply } from 'fastify'
import { invoicesService } from './invoices.service'

export class InvoicesController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { customerId, ...data } = request.body as any

    const result = await invoicesService.create(companyId, customerId, data)
    reply.status(201).send(result)
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }

    const result = await invoicesService.getById(companyId, id)
    reply.send(result)
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const query = request.query as any
    const result = await invoicesService.list(companyId, query)
    reply.send(result)
  }

  async sendToPayment(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }

    const result = await invoicesService.sendToPayment(companyId, id)
    reply.send(result)
  }

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }
    const body = request.body as any

    const result = await invoicesService.cancel(companyId, id, body)
    reply.send(result)
  }

  async markAsPaid(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }
    const { paymentId } = request.body as any

    const result = await invoicesService.markAsPaid(companyId, id, paymentId)
    reply.send(result)
  }
}

export const invoicesController = new InvoicesController()
