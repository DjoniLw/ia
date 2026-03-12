import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  AvailabilityQuery,
  CalendarQuery,
  CancelAppointmentDto,
  CreateAppointmentDto,
  CreateBlockedSlotDto,
  ListAppointmentsQuery,
  UpdateAppointmentDto,
} from './appointments.dto'
import { AppointmentsService } from './appointments.service'

export async function appointmentsRoutes(app: FastifyInstance) {
  const svc = new AppointmentsService()

  // ── Availability & Calendar (before /:id to avoid conflict) ──────────────────

  app.get('/appointments/availability', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = AvailabilityQuery.parse(req.query)
    return reply.send(await svc.getAvailability(req.clinicId, q))
  })

  app.get('/appointments/calendar', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = CalendarQuery.parse(req.query)
    return reply.send(await svc.getCalendar(req.clinicId, q))
  })

  // ── Blocked Slots ─────────────────────────────────────────────────────────────

  app.post(
    '/appointments/blocked-slots',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateBlockedSlotDto.parse(req.body)
      return reply.status(201).send(await svc.createBlockedSlot(req.clinicId, dto))
    },
  )

  app.get('/appointments/blocked-slots', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { professionalId } = req.query as { professionalId?: string }
    return reply.send(await svc.listBlockedSlots(req.clinicId, professionalId))
  })

  app.delete(
    '/appointments/blocked-slots/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.deleteBlockedSlot(req.clinicId, id))
    },
  )

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  app.get('/appointments', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListAppointmentsQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.post('/appointments', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const dto = CreateAppointmentDto.parse(req.body)
    return reply.status(201).send(await svc.create(req.clinicId, dto))
  })

  app.get('/appointments/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  app.patch('/appointments/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const dto = UpdateAppointmentDto.parse(req.body)
    return reply.send(await svc.update(req.clinicId, id, dto))
  })

  // ── State transitions ─────────────────────────────────────────────────────────

  app.post(
    '/appointments/:id/confirm',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.confirm(req.clinicId, id))
    },
  )

  app.post(
    '/appointments/:id/start',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.start(req.clinicId, id))
    },
  )

  app.post(
    '/appointments/:id/complete',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.complete(req.clinicId, id))
    },
  )

  app.post(
    '/appointments/:id/cancel',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = CancelAppointmentDto.parse(req.body ?? {})
      return reply.send(await svc.cancel(req.clinicId, id, dto))
    },
  )

  app.post(
    '/appointments/:id/no-show',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.noShow(req.clinicId, id))
    },
  )
}
