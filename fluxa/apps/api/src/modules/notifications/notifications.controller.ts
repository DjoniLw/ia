import { FastifyRequest, FastifyReply } from 'fastify'
import { notificationsService } from './notifications.service'

export class NotificationsController {
  async listLogs(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const query = request.query as any
    const result = await notificationsService.logLists(companyId, query)
    reply.send(result)
  }

  async getLog(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }

    const result = await notificationsService.getLog(companyId, id)
    reply.send(result)
  }

  async retryNotification(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.user as any)?.companyId
    if (!companyId) return reply.status(401).send({ message: 'Unauthorized' })

    const { id } = request.params as { id: string }

    const result = await notificationsService.retryNotification(companyId, id)
    reply.send(result)
  }
}

export const notificationsController = new NotificationsController()
