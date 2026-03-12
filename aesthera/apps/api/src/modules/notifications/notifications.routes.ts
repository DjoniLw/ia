import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { ListNotificationsQuery } from './notifications.dto'
import { NotificationsService } from './notifications.service'

export async function notificationsRoutes(app: FastifyInstance) {
  const svc = new NotificationsService()

  app.get('/notifications/logs', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListNotificationsQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.get('/notifications/logs/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  app.post('/notifications/logs/:id/retry', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.retry(req.clinicId, id))
  })
}
