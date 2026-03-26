import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreateFieldDto,
  CreateRecordDto,
  ListRecordsQuery,
  UpdateFieldDto,
} from './body-measurements.dto'
import { BodyMeasurementsService } from './body-measurements.service'

export async function bodyMeasurementsRoutes(app: FastifyInstance) {
  const svc = new BodyMeasurementsService()

  // Marca todas as rotas deste módulo como depreciadas (substituídas por /measurement-sheets e /measurement-sessions)
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Deprecated', 'true')
    return payload
  })

  // ─── Fields ─────────────────────────────────────────────────────────────────

  /**
   * GET /body-measurements/fields
   * Guard: admin, staff, professional
   * Lista campos ativos/inativos ordenados por `order`.
   */
  app.get(
    '/body-measurements/fields',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      // Admin pode passar ?includeInactive=true para ver todos os campos
      const includeInactive = (req.query as Record<string, string>).includeInactive === 'true'
      const activeOnly = !includeInactive
      return reply.send(await svc.listFields(req.clinicId, activeOnly))
    },
  )

  /**
   * POST /body-measurements/fields
   * Guard: admin only
   */
  app.post(
    '/body-measurements/fields',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateFieldDto.parse(req.body)
      return reply.status(201).send(await svc.createField(req.clinicId, dto))
    },
  )

  /**
   * PATCH /body-measurements/fields/:id
   * Guard: admin only
   */
  app.patch(
    '/body-measurements/fields/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateFieldDto.parse(req.body)
      return reply.send(await svc.updateField(id, req.clinicId, dto))
    },
  )

  /**
   * DELETE /body-measurements/fields/:id
   * Guard: admin only
   * Soft-delete: active = false — NUNCA DELETE físico
   */
  app.delete(
    '/body-measurements/fields/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.deleteField(id, req.clinicId)
      return reply.status(204).send()
    },
  )

  // ─── Records ─────────────────────────────────────────────────────────────────

  /**
   * GET /body-measurements
   * Guard: admin, staff, professional (professional: RN18 via Appointment)
   */
  app.get(
    '/body-measurements',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const q = ListRecordsQuery.parse(req.query)
      return reply.send(
        await svc.listRecords(req.clinicId, q, req.user.role, req.user.sub),
      )
    },
  )

  /**
   * POST /body-measurements
   * Guard: admin, staff
   */
  app.post(
    '/body-measurements',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const dto = CreateRecordDto.parse(req.body)
      return reply.status(201).send(
        await svc.createRecord(req.clinicId, req.user.sub, dto, req.log),
      )
    },
  )

  /**
   * DELETE /body-measurements/:id
   * Guard: admin only
   * Hard-delete aceito para registros de medição.
   */
  app.delete(
    '/body-measurements/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.deleteRecord(id, req.clinicId)
      return reply.status(204).send()
    },
  )
}
