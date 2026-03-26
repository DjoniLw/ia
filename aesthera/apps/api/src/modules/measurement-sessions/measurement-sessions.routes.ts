import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreateSessionDto,
  ListSessionsQuery,
  UpdateSessionDto,
} from './measurement-sessions.dto'
import { MeasurementSessionsService } from './measurement-sessions.service'

export async function measurementSessionsRoutes(app: FastifyInstance) {
  const svc = new MeasurementSessionsService()

  /**
   * GET /measurement-sessions
   * Guard: admin, staff, professional
   * Query: { customerId, page?, limit? }
   */
  app.get(
    '/measurement-sessions',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const q = ListSessionsQuery.parse(req.query)
      return reply.send(await svc.listSessions(req.clinicId, q))
    },
  )

  /**
   * POST /measurement-sessions
   * Guard: admin, staff
   */
  app.post(
    '/measurement-sessions',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const dto = CreateSessionDto.parse(req.body)
      return reply.status(201).send(
        await svc.createSession(req.clinicId, req.user.sub, dto, req.log),
      )
    },
  )

  /**
   * PATCH /measurement-sessions/:id
   * Guard: admin, staff, professional (professional: somente createdById === req.user.sub)
   */
  app.patch(
    '/measurement-sessions/:id',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateSessionDto.parse(req.body)
      return reply.send(
        await svc.updateSession(id, req.clinicId, req.user.sub, req.user.role, dto),
      )
    },
  )

  /**
   * DELETE /measurement-sessions/:id
   * Guard: admin only
   */
  app.delete(
    '/measurement-sessions/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.deleteSession(id, req.clinicId)
      return reply.status(204).send()
    },
  )
}
