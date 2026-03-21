import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { SetBusinessHoursDto, UpdateClinicDto, UpdatePaymentMethodConfigDto } from './clinics.dto'
import { ClinicsService } from './clinics.service'

export async function clinicsRoutes(app: FastifyInstance) {
  const service = new ClinicsService()

  // GET /clinics/me
  app.get('/clinics/me', { preHandler: [jwtClinicGuard] }, async (request, reply) => {
    const clinic = await service.getMe(request.clinicId)
    return reply.send(clinic)
  })

  app.get(
    '/clinics/lookup-cnpj',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const { cnpj } = request.query as { cnpj?: string }
      if (!cnpj) return reply.status(400).send({ message: 'CNPJ obrigatório' })
      const result = await service.lookupCnpj(cnpj)
      return reply.send(result)
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

  app.get(
    '/clinics/me/payment-methods',
    { preHandler: [jwtClinicGuard] },
    async (request, reply) => {
      const config = await service.getPaymentMethodConfig(request.clinicId)
      return reply.send(config)
    },
  )

  app.put(
    '/clinics/me/payment-methods',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const dto = UpdatePaymentMethodConfigDto.parse(request.body)
      const config = await service.updatePaymentMethodConfig(request.clinicId, dto)
      return reply.send(config)
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
