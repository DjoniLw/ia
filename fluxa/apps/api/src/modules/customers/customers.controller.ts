import { FastifyRequest, FastifyReply } from 'fastify'
import { customersService } from './customers.service'

export class CustomersController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId // From JWT token
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const result = await customersService.create(companyId, request.body as any)
    reply.status(201).send(result)
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }

    const result = await customersService.getById(companyId, id)
    reply.send(result)
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const query = request.query as any
    const result = await customersService.list(companyId, query)
    reply.send(result)
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }

    const result = await customersService.update(companyId, id, request.body as any)
    reply.send(result)
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }

    await customersService.delete(companyId, id)
    reply.status(204).send()
  }

  async search(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { q } = request.query as { q: string }
    if (!q) return reply.status(400).send({ message: 'Query parameter "q" is required' })

    const result = await customersService.search(companyId, q)
    reply.send(result)
  }
}

export const customersController = new CustomersController()
