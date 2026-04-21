import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { professionalCustomerAccessGuard } from '../../shared/guards/professional-customer-access.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreatePhotosDto,
  DeletePhotoDto,
  ListPhotosQueryDto,
  RequestUploadUrlDto,
  UpdateBodyRegionsDto,
} from './customer-photos.dto'
import { CustomerPhotosService } from './customer-photos.service'

export async function customerPhotosRoutes(app: FastifyInstance) {
  const svc = new CustomerPhotosService()

  /**
   * POST /customers/:customerId/photos/upload-url
   * Guard: admin, staff, professional (com verificação de agendamento elegível)
   * Rate limit: 20 req / 10 min por userId
   * Gera presigned PUT URLs + cache Redis anti-IDOR.
   */
  app.post(
    '/customers/:customerId/photos/upload-url',
    {
      preHandler: [
        jwtClinicGuard,
        roleGuard(['admin', 'staff', 'professional']),
        professionalCustomerAccessGuard,
      ],
      config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
    },
    async (req, reply) => {
      const { customerId } = req.params as { customerId: string }
      const dto = RequestUploadUrlDto.parse(req.body)
      const result = await svc.requestUploadUrls({
        clinicId: req.clinicId,
        customerId,
        userId: req.user.sub,
        dto,
        ip: req.ip,
      })
      return reply.status(200).send(result)
    },
  )

  /**
   * POST /customers/:customerId/photos
   * Guard: admin, staff, professional (com verificação de agendamento elegível)
   * Confirma fotos após upload direto ao storage — valida Redis anti-IDOR.
   */
  app.post(
    '/customers/:customerId/photos',
    {
      preHandler: [
        jwtClinicGuard,
        roleGuard(['admin', 'staff', 'professional']),
        professionalCustomerAccessGuard,
      ],
    },
    async (req, reply) => {
      const { customerId } = req.params as { customerId: string }
      const dto = CreatePhotosDto.parse(req.body)
      const professionalId =
        req.user.role === 'professional' ? req.user.sub : undefined
      const result = await svc.createPhotos({
        clinicId: req.clinicId,
        customerId,
        userId: req.user.sub,
        professionalId,
        dto,
        ip: req.ip,
      })
      return reply.status(201).send(result)
    },
  )

  /**
   * GET /customers/:customerId/photos
   * Guard: admin, staff, professional (com verificação de agendamento elegível)
   * Lista fotos paginadas com filtros; gera presigned GET URLs + log de auditoria.
   */
  app.get(
    '/customers/:customerId/photos',
    {
      preHandler: [
        jwtClinicGuard,
        roleGuard(['admin', 'staff', 'professional']),
        professionalCustomerAccessGuard,
      ],
    },
    async (req, reply) => {
      const { customerId } = req.params as { customerId: string }
      const query = ListPhotosQueryDto.parse(req.query)
      const result = await svc.listPhotos({
        clinicId: req.clinicId,
        customerId,
        userId: req.user.sub,
        query,
        ip: req.ip,
      })
      return reply.send(result)
    },
  )

  /**
   * GET /customers/:customerId/photos/:photoId/url
   * Guard: admin, staff, professional (com verificação de agendamento elegível)
   * Revalida permissões e gera nova presigned URL para foto individual.
   */
  app.get(
    '/customers/:customerId/photos/:photoId/url',
    {
      preHandler: [
        jwtClinicGuard,
        roleGuard(['admin', 'staff', 'professional']),
        professionalCustomerAccessGuard,
      ],
    },
    async (req, reply) => {
      const { customerId, photoId } = req.params as {
        customerId: string
        photoId: string
      }
      const result = await svc.getPhotoUrl({
        clinicId: req.clinicId,
        customerId,
        photoId,
        userId: req.user.sub,
        ip: req.ip,
      })
      return reply.send(result)
    },
  )

  /**
   * DELETE /customers/:customerId/photos/:photoId
   * Guard: admin only
   * Soft delete com justificativa obrigatória (mín. 10 chars).
   */
  app.delete(
    '/customers/:customerId/photos/:photoId',
    {
      preHandler: [jwtClinicGuard, roleGuard(['admin'])],
    },
    async (req, reply) => {
      const { customerId, photoId } = req.params as {
        customerId: string
        photoId: string
      }
      const dto = DeletePhotoDto.parse(req.body)
      const result = await svc.deletePhoto({
        clinicId: req.clinicId,
        customerId,
        photoId,
        userId: req.user.sub,
        dto,
        ip: req.ip,
      })
      return reply.send(result)
    },
  )

  // ── Settings: regiões corporais ───────────────────────────────────────────

  /**
   * GET /settings/photo-body-regions
   * Guard: admin, staff
   * Retorna lista de regiões corporais configuradas pela clínica.
   */
  app.get(
    '/settings/photo-body-regions',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const regions = await svc.getBodyRegions(req.clinicId)
      return reply.send({ regions })
    },
  )

  /**
   * PATCH /settings/photo-body-regions
   * Guard: admin only
   * Atualiza lista de regiões corporais (máx. 30).
   */
  app.patch(
    '/settings/photo-body-regions',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = UpdateBodyRegionsDto.parse(req.body)
      const regions = await svc.updateBodyRegions(req.clinicId, dto.regions)
      return reply.send({ regions })
    },
  )
}
