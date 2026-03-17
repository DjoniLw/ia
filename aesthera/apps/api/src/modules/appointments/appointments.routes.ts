import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../database/prisma/client'
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
import { ScheduleAvailabilityService } from './scheduleAvailability.service'

export async function appointmentsRoutes(app: FastifyInstance) {
  const svc = new AppointmentsService()
  const availability = new ScheduleAvailabilityService()

  // ── Availability & Calendar (before /:id to avoid conflict) ──────────────────

  app.get('/appointments/availability', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = AvailabilityQuery.parse(req.query)
    return reply.send(await svc.getAvailability(req.clinicId, q))
  })

  app.get('/appointments/calendar', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = CalendarQuery.parse(req.query)
    return reply.send(await svc.getCalendar(req.clinicId, q))
  })

  // ── Available slots for a service on a date ───────────────────────────────────
  // GET /appointments/available-slots?serviceId=UUID&date=YYYY-MM-DD[&professionalId=UUID][&equipmentId=UUID][&roomId=UUID]
  app.get('/appointments/available-slots', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = z.object({
      serviceId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      professionalId: z.string().uuid().optional(),
      equipmentId: z.string().uuid().optional(),
      roomId: z.string().uuid().optional(),
    }).parse(req.query)
    return reply.send(
      await availability.getAvailableSlots(req.clinicId, q.serviceId, q.date, q.professionalId, q.equipmentId, q.roomId),
    )
  })

  // ── Available professionals for a service on a date ───────────────────────────
  // GET /appointments/available-professionals?serviceId=UUID&date=YYYY-MM-DD[&time=HH:MM]
  // (Supersedes the previous ?date=&time= version)
  app.get('/appointments/available-professionals', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = z.object({
      serviceId: z.string().uuid().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }).parse(req.query)

    if (q.serviceId) {
      return reply.send(
        await availability.getAvailableProfessionals(req.clinicId, q.serviceId, q.date, q.time),
      )
    }

    // Fallback: original behaviour (no service filter) — kept for compatibility
    return reply.send(await svc.getAvailableProfessionals(req.clinicId, q.date, q.time ?? ''))
  })

  // ── Available equipment for a given time slot (Feature 9) ────────────────────
  // GET /appointments/available-equipment?scheduledAt=ISO&durationMinutes=N[&excludeAppointmentId=UUID]
  app.get('/appointments/available-equipment', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = z.object({
      scheduledAt: z.string().datetime(),
      durationMinutes: z.coerce.number().int().positive(),
      excludeAppointmentId: z.string().uuid().optional(),
    }).parse(req.query)

    const scheduledAt = new Date(q.scheduledAt)
    const slotEnd = new Date(scheduledAt.getTime() + q.durationMinutes * 60 * 1000)

    // All active equipment for this clinic
    const allEquipment = await prisma.equipment.findMany({
      where: { clinicId: req.clinicId, active: true },
      orderBy: { name: 'asc' },
    })

    // Find equipment that is busy (overlapping active appointments) during the slot
    const busyLinks = await prisma.appointmentEquipment.findMany({
      where: {
        appointment: {
          clinicId: req.clinicId,
          status: { notIn: ['cancelled', 'no_show'] },
          ...(q.excludeAppointmentId ? { id: { not: q.excludeAppointmentId } } : {}),
          scheduledAt: { lt: slotEnd },
        },
      },
      include: {
        appointment: { select: { scheduledAt: true, durationMinutes: true } },
      },
    })

    const busyIds = new Set(
      busyLinks
        .filter((l) => {
          const apptEnd = new Date(l.appointment.scheduledAt.getTime() + l.appointment.durationMinutes * 60_000)
          return scheduledAt < apptEnd && slotEnd > l.appointment.scheduledAt
        })
        .map((l) => l.equipmentId),
    )

    return reply.send(
      allEquipment.map((eq) => ({ ...eq, available: !busyIds.has(eq.id) })),
    )
  })

  // ── Available rooms for a given time slot ───────────────────────────────────
  // GET /appointments/available-rooms?scheduledAt=ISO&durationMinutes=N[&excludeAppointmentId=UUID]
  app.get('/appointments/available-rooms', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = z.object({
      scheduledAt: z.string().datetime(),
      durationMinutes: z.coerce.number().int().positive(),
      excludeAppointmentId: z.string().uuid().optional(),
    }).parse(req.query)

    const scheduledAt = new Date(q.scheduledAt)
    const slotEnd = new Date(scheduledAt.getTime() + q.durationMinutes * 60 * 1000)

    // All active rooms for this clinic
    const allRooms = await prisma.room.findMany({
      where: { clinicId: req.clinicId, active: true },
      orderBy: { name: 'asc' },
    })

    // Find rooms that are busy during the slot
    const busyAppointments = await prisma.appointment.findMany({
      where: {
        clinicId: req.clinicId,
        roomId: { not: null },
        status: { notIn: ['cancelled', 'no_show'] },
        ...(q.excludeAppointmentId ? { id: { not: q.excludeAppointmentId } } : {}),
        scheduledAt: { lt: slotEnd },
      },
      select: { roomId: true, scheduledAt: true, durationMinutes: true },
    })

    const busyIds = new Set(
      busyAppointments
        .filter((a) => {
          const apptEnd = new Date(a.scheduledAt.getTime() + a.durationMinutes * 60_000)
          return scheduledAt < apptEnd && slotEnd > a.scheduledAt
        })
        .map((a) => a.roomId as string),
    )

    return reply.send(
      allRooms.map((r) => ({ ...r, available: !busyIds.has(r.id) })),
    )
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

