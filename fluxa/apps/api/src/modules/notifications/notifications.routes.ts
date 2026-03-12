import { FastifyInstance } from 'fastify'
import { notificationsController } from './notifications.controller'
import { jwtGuard } from '../../shared/guards/jwt.guard'
import { ListNotificationLogsDto } from './notifications.dto'

export async function notificationsRoutes(app: FastifyInstance) {
  // All routes require JWT authentication
  app.get<{ Querystring: ListNotificationLogsDto }>(
    '/notifications/logs',
    { onRequest: jwtGuard },
    async (request, reply) => {
      const validated = ListNotificationLogsDto.parse(request.query)
      request.query = validated
      await notificationsController.listLogs(request, reply)
    },
  )

  app.get<{ Params: { id: string } }>(
    '/notifications/logs/:id',
    { onRequest: jwtGuard },
    async (request, reply) => {
      await notificationsController.getLog(request, reply)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/notifications/logs/:id/retry',
    { onRequest: jwtGuard },
    async (request, reply) => {
      await notificationsController.retryNotification(request, reply)
    },
  )
}
