import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { SetBusinessHoursDto, UpdateClinicDto } from './clinics.dto'
import { ClinicsService } from './clinics.service'

export async function clinicsRoutes(app: FastifyInstance) {
  const service = new ClinicsService()

  // GET /clinics/me
  app.get(
    '/clinics/me',
    { preHandler: [jwtClinicGuard] },
    async (request, reply) => {
      const clinic = await service.getMe(request.clinicId)
      return reply.send(clinic)
    },
  )

  // PATCH /clinics/me
  app.patch(
    '/clinics/me',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const dto = UpdateClinicDto.parse(request.body)
      const clinic = await service.updateMe(request.clinicId, dto)
      return reply.send(clinic)
    },
  )

  // GET /clinics/me/business-hours
  app.get(
    '/clinics/me/business-hours',
    { preHandler: [jwtClinicGuard] },
    async (request, reply) => {
      const hours = await service.getBusinessHours(request.clinicId)
      return reply.send(hours)
    },
  )

  // PUT /clinics/me/business-hours
  app.put(
    '/clinics/me/business-hours',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const dto = SetBusinessHoursDto.parse(request.body)
      const hours = await service.setBusinessHours(request.clinicId, dto)
      return reply.send(hours)
    },
  )
}
