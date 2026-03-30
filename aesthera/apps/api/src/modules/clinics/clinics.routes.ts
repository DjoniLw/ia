import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { SetBusinessHoursDto, UpdateClinicDto, UpdatePaymentMethodConfigDto, UpdateSmtpSettingsDto, UpdateWhatsappSettingsDto } from './clinics.dto'
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

  // GET /clinics/me/smtp
  app.get(
    '/clinics/me/smtp',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      return reply.send(await service.getSmtpSettings(request.clinicId))
    },
  )

  // PUT /clinics/me/smtp
  app.put(
    '/clinics/me/smtp',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const dto = UpdateSmtpSettingsDto.parse(request.body)
      return reply.send(await service.updateSmtpSettings(request.clinicId, dto))
    },
  )

  // POST /clinics/me/smtp/test
  app.post(
    '/clinics/me/smtp/test',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      return reply.send(await service.testSmtpSettings(request.clinicId))
    },
  )

  // ─── WhatsApp por clínica ──────────────────────────────────────────────────

  // GET /clinics/me/whatsapp
  app.get(
    '/clinics/me/whatsapp',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      return reply.send(await service.getWhatsappSettings(request.clinicId))
    },
  )

  // PUT /clinics/me/whatsapp
  app.put(
    '/clinics/me/whatsapp',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const dto = UpdateWhatsappSettingsDto.parse(request.body)
      return reply.send(await service.updateWhatsappInstance(request.clinicId, dto))
    },
  )

  // GET /clinics/me/whatsapp/qrcode
  app.get(
    '/clinics/me/whatsapp/qrcode',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      return reply.send(await service.getWhatsappQrCode(request.clinicId))
    },
  )

  // DELETE /clinics/me/whatsapp/disconnect
  app.delete(
    '/clinics/me/whatsapp/disconnect',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      return reply.send(await service.disconnectWhatsapp(request.clinicId))
    },
  )
}
