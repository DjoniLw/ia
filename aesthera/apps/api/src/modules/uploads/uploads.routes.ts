import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { ConfirmUploadDto, PresignDto } from './uploads.dto'
import { UploadsService } from './uploads.service'

export async function uploadsRoutes(app: FastifyInstance) {
  const svc = new UploadsService()

  /**
   * POST /uploads/presign
   * Guard: admin, staff
   * Gera presigned PUT URL para upload direto ao R2.
   */
  app.post(
    '/uploads/presign',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const dto = PresignDto.parse(req.body)
      const result = await svc.presign(req.clinicId, req.user.sub, dto)
      return reply.status(200).send(result)
    },
  )

  /**
   * POST /uploads/confirm
   * Guard: admin, staff
   * Confirma upload: HEAD no storage + magic bytes + persiste CustomerFile.
   */
  app.post(
    '/uploads/confirm',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const dto = ConfirmUploadDto.parse(req.body)
      const file = await svc.confirm(req.clinicId, req.user.sub, dto)
      return reply.status(201).send(file)
    },
  )

  /**
   * GET /uploads/:id/url
   * Guard: admin, staff, professional
   * Retorna presigned GET URL (TTL 1h) — NUNCA URLs permanentes.
   */
  app.get(
    '/uploads/:id/url',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff', 'professional'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const result = await svc.getUrl(
        id,
        req.clinicId,
        req.user.sub,
        req.user.role,
        // professionalId: o token de professional contém o ID do profissional no campo `sub`
        req.user.role === 'professional' ? req.user.sub : undefined,
      )
      return reply.send(result)
    },
  )

  /**
   * DELETE /uploads/:id
   * Guard: admin only
   * Soft-delete: atualiza deletedAt — NUNCA hard-delete.
   */
  app.delete(
    '/uploads/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.softDelete(id, req.clinicId)
      return reply.status(204).send()
    },
  )
}
