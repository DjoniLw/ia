import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import type {
  AvailabilityQuery,
  CalendarQuery,
  CancelAppointmentDto,
  CreateAppointmentDto,
  CreateBlockedSlotDto,
  ListAppointmentsQuery,
  UpdateAppointmentDto,
} from './appointments.dto'
import { AppointmentsRepository } from './appointments.repository'
import { PackagesRepository } from '../packages/packages.repository'
import { BillingService } from '../billing/billing.service'

// HH:MM → minutes from midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// DateTime → minutes from midnight (UTC)
function dateToMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

// FNV-1a 32-bit hash for advisory locks — better distribution than additive sums
function hashToInt32(s: string): number {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  // Clamp to positive signed 32-bit range for pg_advisory_xact_lock
  return h & 0x7fffffff
}

export class AppointmentsService {
  private repo = new AppointmentsRepository()
  private pkgRepo = new PackagesRepository()
  private billingService = new BillingService()

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  async list(clinicId: string, q: ListAppointmentsQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const a = await this.repo.findById(clinicId, id)
    if (!a) throw new NotFoundError('Appointment')
    return a
  }

  async create(clinicId: string, dto: CreateAppointmentDto) {
    const scheduledDate = new Date(dto.scheduledAt)
    const dateStr = scheduledDate.toISOString().slice(0, 10)

    // R10 — Sala obrigatória
    if (!dto.roomId) {
      throw new AppError('Sala é obrigatória para confirmar o agendamento', 400, 'ROOM_REQUIRED')
    }

    // Use Postgres advisory lock to prevent double-booking
    const lockId = hashToInt32(dto.professionalId + dateStr)

    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`

      // ── Multi-service path ───────────────────────────────────────────────────
      if (dto.services && dto.services.length > 0) {
        // Validate all services exist
        const serviceIds = dto.services.map((s) => s.serviceId)
        const services: Array<{ id: string; price: number; durationMinutes: number }> =
          await tx.service.findMany({
            where: { id: { in: serviceIds }, clinicId, active: true, deletedAt: null },
          })
        if (services.length !== serviceIds.length) {
          throw new NotFoundError('Service')
        }

        // Verify professional belongs to clinic and is active
        const professional = await tx.professional.findFirst({
          where: { id: dto.professionalId, clinicId, active: true, deletedAt: null },
        })
        if (!professional) throw new NotFoundError('Professional')

        // Verify professional is assigned to all services
        for (const svcId of serviceIds) {
          const hasService = await this.repo.checkProfessionalHasService(dto.professionalId, svcId)
          if (!hasService) {
            throw new AppError(
              'Professional is not assigned to this service',
              400,
              'SERVICE_NOT_ASSIGNED',
            )
          }
        }

        // Verify customer belongs to clinic
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, clinicId, deletedAt: null },
        })
        if (!customer) throw new NotFoundError('Customer')

        // Compute totals from all services
        const serviceMap = new Map(services.map((s) => [s.id, s]))
        const totalDuration = services.reduce((sum: number, s) => sum + s.durationMinutes, 0)
        const totalPrice =
          dto.price ??
          dto.services.reduce((sum: number, s) => {
            const svcPrice = s.price ?? serviceMap.get(s.serviceId)?.price ?? 0
            return sum + svcPrice
          }, 0)

        // Check availability with computed total duration
        await this.assertSlotAvailable(
          clinicId,
          dto.professionalId,
          scheduledDate,
          totalDuration,
          dateStr,
        )

        if (dto.equipmentIds && dto.equipmentIds.length > 0) {
          await this.assertEquipmentAvailable(
            clinicId,
            dto.equipmentIds,
            scheduledDate,
            totalDuration,
          )
        }

        if (dto.roomId) {
          await this.assertRoomAvailable(clinicId, dto.roomId, scheduledDate, totalDuration)
        }

        // Use first service's id as the appointment serviceId for backward compat
        const primaryServiceId = dto.services[0].serviceId

        const appointment = await tx.appointment.create({
          data: {
            clinicId,
            customerId: dto.customerId,
            professionalId: dto.professionalId,
            serviceId: primaryServiceId,
            roomId: dto.roomId ?? null,
            scheduledAt: scheduledDate,
            durationMinutes: totalDuration,
            price: totalPrice,
            notes: dto.notes,
          },
        })

        // Create service items
        await tx.appointmentServiceItem.createMany({
          data: dto.services.map((s, idx) => ({
            appointmentId: appointment.id,
            serviceId: s.serviceId,
            clinicId,
            price: s.price ?? serviceMap.get(s.serviceId)?.price ?? 0,
            durationMinutes: serviceMap.get(s.serviceId)?.durationMinutes ?? 0,
            order: idx,
          })),
        })

        if (dto.equipmentIds && dto.equipmentIds.length > 0) {
          await tx.appointmentEquipment.createMany({
            data: dto.equipmentIds.map((equipmentId: string) => ({
              appointmentId: appointment.id,
              equipmentId,
            })),
            skipDuplicates: true,
          })
        }

        if (dto.packageSessionId) {
          await this.validateAndLinkPackageSession(
            clinicId,
            dto.packageSessionId,
            appointment.id,
            serviceIds,
          )
        }

        return this.repo.findById(clinicId, appointment.id)
      }

      // ── Single-service (legacy) path ─────────────────────────────────────────
      const serviceId = dto.serviceId!

      const service = await tx.service.findFirst({
        where: { id: serviceId, clinicId, active: true, deletedAt: null },
      })
      if (!service) throw new NotFoundError('Service')

      const professional = await tx.professional.findFirst({
        where: { id: dto.professionalId, clinicId, active: true, deletedAt: null },
      })
      if (!professional) throw new NotFoundError('Professional')

      const hasService = await this.repo.checkProfessionalHasService(dto.professionalId, serviceId)
      if (!hasService) {
        throw new AppError(
          'Professional is not assigned to this service',
          400,
          'SERVICE_NOT_ASSIGNED',
        )
      }

      const customer = await tx.customer.findFirst({
        where: { id: dto.customerId, clinicId, deletedAt: null },
      })
      if (!customer) throw new NotFoundError('Customer')

      const durationMinutes = service.durationMinutes
      await this.assertSlotAvailable(
        clinicId,
        dto.professionalId,
        scheduledDate,
        durationMinutes,
        dateStr,
      )

      if (dto.equipmentIds && dto.equipmentIds.length > 0) {
        await this.assertEquipmentAvailable(
          clinicId,
          dto.equipmentIds,
          scheduledDate,
          durationMinutes,
        )
      }

      if (dto.roomId) {
        await this.assertRoomAvailable(clinicId, dto.roomId, scheduledDate, durationMinutes)
      }

      const appointment = await this.repo.create(clinicId, {
        ...dto,
        serviceId,
        durationMinutes,
        price: dto.price ?? service.price,
      })

      if (dto.equipmentIds && dto.equipmentIds.length > 0) {
        await prisma.appointmentEquipment.createMany({
          data: dto.equipmentIds.map((equipmentId) => ({
            appointmentId: appointment.id,
            equipmentId,
          })),
          skipDuplicates: true,
        })
      }

      if (dto.packageSessionId) {
        await this.validateAndLinkPackageSession(
          clinicId,
          dto.packageSessionId,
          appointment.id,
          [serviceId],
        )
      }

      return appointment
    })
  }

  /**
   * Validates a package session before linking it to an appointment (RN-S02).
   * Throws descriptive errors for each failure condition.
   */
  private async validateAndLinkPackageSession(
    clinicId: string,
    sessionId: string,
    appointmentId: string,
    serviceIds: string[],
  ) {
    const session = await this.pkgRepo.findSessionById(clinicId, sessionId)

    if (!session || session.clinicId !== clinicId) {
      throw new NotFoundError('CustomerPackageSession')
    }

    if (session.status === 'AGENDADO') {
      throw new AppError('Sessão já está reservada para outro agendamento', 409, 'SESSION_ALREADY_RESERVED')
    }

    if (session.status === 'FINALIZADO') {
      throw new AppError('Sessão já foi utilizada', 400, 'SESSION_ALREADY_REDEEMED')
    }

    if (session.status === 'EXPIRADO') {
      throw new AppError('Sessão expirada', 400, 'PACKAGE_EXPIRED')
    }

    if (session.status !== 'ABERTO') {
      throw new AppError('Sessão não está disponível', 400, 'PACKAGE_NO_SESSIONS_AVAILABLE')
    }

    // Check package expiry
    const cp = await this.pkgRepo.findCustomerPackageById(clinicId, session.customerPackageId)
    if (cp?.expiresAt && cp.expiresAt < new Date()) {
      throw new AppError('Pacote expirado', 400, 'PACKAGE_EXPIRED')
    }

    // Validate serviceId matches one of the appointment services
    if (!serviceIds.includes(session.serviceId)) {
      throw new AppError(
        'Sessão do pacote não é compatível com o serviço do agendamento',
        400,
        'SESSION_SERVICE_MISMATCH',
      )
    }

    await this.pkgRepo.linkSession(sessionId, appointmentId)
  }

  async update(clinicId: string, id: string, dto: UpdateAppointmentDto) {
    const a = await this.get(clinicId, id)
    if (!['draft', 'confirmed'].includes(a.status)) {
      throw new AppError(
        'Only draft or confirmed appointments can be rescheduled',
        400,
        'INVALID_STATUS',
      )
    }

    if (dto.scheduledAt) {
      const scheduledDate = new Date(dto.scheduledAt)
      const dateStr = scheduledDate.toISOString().slice(0, 10)
      await this.assertSlotAvailable(
        clinicId,
        a.professionalId,
        scheduledDate,
        a.durationMinutes,
        dateStr,
        id,
      )

      if (dto.equipmentIds && dto.equipmentIds.length > 0) {
        await this.assertEquipmentAvailable(
          clinicId,
          dto.equipmentIds,
          scheduledDate,
          a.durationMinutes,
          id,
        )
      }

      if (dto.roomId) {
        await this.assertRoomAvailable(clinicId, dto.roomId, scheduledDate, a.durationMinutes, id)
      }
    }

    const updated = await this.repo.update(clinicId, id, dto)

    // Update equipment associations when provided
    if (dto.equipmentIds !== undefined) {
      await prisma.appointmentEquipment.deleteMany({ where: { appointmentId: id } })
      if (dto.equipmentIds.length > 0) {
        await prisma.appointmentEquipment.createMany({
          data: dto.equipmentIds.map((equipmentId) => ({ appointmentId: id, equipmentId })),
          skipDuplicates: true,
        })
      }
    }

    return updated
  }

  // ── State machine ─────────────────────────────────────────────────────────────

  async confirm(clinicId: string, id: string) {
    const a = await this.get(clinicId, id)
    if (a.status !== 'draft') {
      throw new AppError('Only draft appointments can be confirmed', 400, 'INVALID_STATUS')
    }
    return this.repo.transition(clinicId, id, 'confirmed')
  }

  async start(clinicId: string, id: string) {
    const a = await this.get(clinicId, id)
    if (a.status !== 'confirmed') {
      throw new AppError('Only confirmed appointments can be started', 400, 'INVALID_STATUS')
    }
    return this.repo.transition(clinicId, id, 'in_progress')
  }

  async complete(clinicId: string, id: string) {
    const a = await this.get(clinicId, id)
    if (a.status !== 'in_progress') {
      throw new AppError('Only in-progress appointments can be completed', 400, 'INVALID_STATUS')
    }
    const completed = await this.repo.transition(clinicId, id, 'completed', {
      completedAt: new Date(),
    })

    // Check if this appointment has a reserved (but not yet used) package session
    const linkedSession = await this.pkgRepo.findLinkedSession(clinicId, id)
    if (linkedSession) {
      // Redeem the session — no billing is created since the package was pre-paid
      await this.pkgRepo.redeemSession(linkedSession.id, id)
      return completed
    }

    // If multi-service appointment, compute total price from service items
    const serviceItems = completed.serviceItems
    const billingPrice =
      serviceItems && serviceItems.length > 0
        ? serviceItems.reduce((sum: number, item: { price: number }) => sum + item.price, 0)
        : completed.price

    // Auto-create billing (idempotent)
    await this.billingService.createForAppointment({ ...completed, price: billingPrice })

    return completed
  }

  async cancel(clinicId: string, id: string, dto: CancelAppointmentDto) {
    const a = await this.get(clinicId, id)
    if (!['draft', 'confirmed'].includes(a.status)) {
      throw new AppError(
        'Only draft or confirmed appointments can be cancelled',
        400,
        'INVALID_STATUS',
      )
    }

    // Unreserve any linked package session so it becomes available again
    const linkedSession = await this.pkgRepo.findLinkedSession(clinicId, id)
    if (linkedSession) {
      await this.pkgRepo.unlinkSession(linkedSession.id)
    }

    return this.repo.transition(clinicId, id, 'cancelled', {
      cancellationReason: dto.cancellationReason,
      cancelledAt: new Date(),
    })
  }

  async noShow(clinicId: string, id: string) {
    const a = await this.get(clinicId, id)
    if (a.status !== 'in_progress') {
      throw new AppError(
        'Only in-progress appointments can be marked as no-show',
        400,
        'INVALID_STATUS',
      )
    }
    return this.repo.transition(clinicId, id, 'no_show')
  }

  // ── Availability ──────────────────────────────────────────────────────────────

  async getAvailability(clinicId: string, q: AvailabilityQuery) {
    const service = await prisma.service.findFirst({
      where: { id: q.serviceId, clinicId, active: true, deletedAt: null },
    })
    if (!service) throw new NotFoundError('Service')

    const dayOfWeek = new Date(q.date + 'T12:00:00Z').getUTCDay()
    const workingHours = await this.repo.getProfessionalWorkingHours(q.professionalId, dayOfWeek)
    if (!workingHours) return { date: q.date, slots: [] }

    const start = timeToMinutes(workingHours.startTime)
    const end = timeToMinutes(workingHours.endTime)
    const dur = service.durationMinutes

    // Collect occupied windows
    const [appointments, blockedSlots] = await Promise.all([
      this.repo.getConflictingAppointments(clinicId, q.professionalId, q.date),
      this.repo.getBlockedSlotsForDate(clinicId, q.professionalId, q.date),
    ])

    const occupied: Array<{ start: number; end: number }> = [
      ...appointments.map((a: { scheduledAt: Date; durationMinutes: number }) => ({
        start: dateToMinutes(a.scheduledAt),
        end: dateToMinutes(a.scheduledAt) + a.durationMinutes,
      })),
      ...blockedSlots.map((b: { startTime: string; endTime: string }) => ({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime),
      })),
    ]

    const slots: string[] = []
    for (let t = start; t + dur <= end; t += 15) {
      const slotEnd = t + dur
      const conflict = occupied.some((o) => t < o.end && slotEnd > o.start)
      if (!conflict) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0')
        const mm = String(t % 60).padStart(2, '0')
        slots.push(`${hh}:${mm}`)
      }
    }

    return { date: q.date, slots }
  }

  // ── Calendar ──────────────────────────────────────────────────────────────────

  async getCalendar(clinicId: string, q: CalendarQuery) {
    const baseDate = new Date(q.date + 'T00:00:00.000Z')
    let dateFrom = baseDate
    let dateTo = new Date(q.date + 'T23:59:59.999Z')

    if (q.view === 'week') {
      const dow = baseDate.getUTCDay()
      dateFrom = new Date(baseDate)
      dateFrom.setUTCDate(baseDate.getUTCDate() - dow)
      dateTo = new Date(dateFrom)
      dateTo.setUTCDate(dateFrom.getUTCDate() + 6)
      dateTo.setUTCHours(23, 59, 59, 999)
    }

    const [appointments, blockedSlots] = await Promise.all([
      this.repo.getCalendarAppointments(clinicId, dateFrom, dateTo, q.professionalId),
      this.repo.getCalendarBlockedSlots(clinicId, dateFrom, dateTo, q.professionalId),
    ])

    // Group by professional
    const profMap = new Map<string, { id: string; name: string; slots: unknown[] }>()

    for (const a of appointments) {
      const profId = a.professionalId
      if (!profMap.has(profId)) {
        profMap.set(profId, { id: profId, name: a.professional.name, slots: [] })
      }
      profMap.get(profId)!.slots.push({
        type: 'appointment',
        id: a.id,
        start: a.scheduledAt.toISOString(),
        duration: a.durationMinutes,
        status: a.status,
        customer: a.customer.name,
        customerId: a.customer.id,
        service: a.service?.name ?? '',
        price: a.price,
        notes: a.notes,
        room: ((a as Record<string, unknown>).room as { id: string; name: string } | null) ?? null,
        equipment: (a.equipment as Array<{ equipment: { id: string; name: string } }>).map(
          (e) => e.equipment,
        ),
      })
    }

    for (const b of blockedSlots) {
      const profId = b.professionalId
      if (!profMap.has(profId)) {
        profMap.set(profId, { id: profId, name: b.professional.name, slots: [] })
      }
      profMap.get(profId)!.slots.push({
        type: 'blocked',
        id: b.id,
        date: b.date?.toISOString().slice(0, 10),
        startTime: b.startTime,
        endTime: b.endTime,
        reason: b.reason,
        recurrence: b.recurrence,
      })
    }

    return {
      date: q.date,
      view: q.view,
      professionals: [...profMap.values()],
    }
  }

  // ── Blocked slots ─────────────────────────────────────────────────────────────

  async createBlockedSlot(clinicId: string, dto: CreateBlockedSlotDto) {
    const professional = await prisma.professional.findFirst({
      where: { id: dto.professionalId, clinicId },
    })
    if (!professional) throw new NotFoundError('Professional')
    return this.repo.createBlockedSlot(clinicId, dto)
  }

  async listBlockedSlots(clinicId: string, professionalId?: string) {
    return this.repo.listBlockedSlots(clinicId, professionalId)
  }

  async deleteBlockedSlot(clinicId: string, id: string) {
    const count = await this.repo.deleteBlockedSlot(clinicId, id)
    if (count.count === 0) throw new NotFoundError('BlockedSlot')
    return { message: 'Blocked slot deleted' }
  }

  // ── Available professionals for a given date + time ───────────────────────────

  async getAvailableProfessionals(clinicId: string, date: string, time: string) {
    const timeMinutes = timeToMinutes(time)
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay()
    const minDuration = 15 // minimum slot in minutes

    const professionals = await prisma.professional.findMany({
      where: { clinicId, active: true, deletedAt: null },
      select: { id: true, name: true, speciality: true },
      orderBy: { name: 'asc' },
    })

    const result = await Promise.all(
      professionals.map(async (prof) => {
        const wh = await this.repo.getProfessionalWorkingHours(prof.id, dayOfWeek)
        if (!wh) return { ...prof, available: false }

        const startMin = timeToMinutes(wh.startTime)
        const endMin = timeToMinutes(wh.endTime)
        if (timeMinutes < startMin || timeMinutes + minDuration > endMin) {
          return { ...prof, available: false }
        }

        const [appointments, blockedSlots] = await Promise.all([
          this.repo.getConflictingAppointments(clinicId, prof.id, date),
          this.repo.getBlockedSlotsForDate(clinicId, prof.id, date),
        ])

        const occupied = [
          ...appointments.map((a: { scheduledAt: Date; durationMinutes: number }) => ({
            start: dateToMinutes(a.scheduledAt),
            end: dateToMinutes(a.scheduledAt) + a.durationMinutes,
          })),
          ...blockedSlots.map((b: { startTime: string; endTime: string }) => ({
            start: timeToMinutes(b.startTime),
            end: timeToMinutes(b.endTime),
          })),
        ]

        const conflict = occupied.some(
          (o) => timeMinutes < o.end && timeMinutes + minDuration > o.start,
        )
        return { ...prof, available: !conflict }
      }),
    )

    return { professionals: result }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async assertEquipmentAvailable(
    clinicId: string,
    equipmentIds: string[],
    scheduledAt: Date,
    durationMinutes: number,
    excludeAppointmentId?: string,
  ) {
    // Verify all equipment belongs to this clinic
    const equipment = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds }, clinicId, active: true },
    })
    if (equipment.length !== equipmentIds.length) {
      throw new AppError('Um ou mais equipamentos não encontrados', 400, 'EQUIPMENT_NOT_FOUND')
    }

    // Find appointments that overlap in time and use any of these equipment items
    const slotEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000)

    const conflicts = await prisma.appointmentEquipment.findMany({
      where: {
        equipmentId: { in: equipmentIds },
        appointment: {
          clinicId,
          status: { notIn: ['cancelled', 'no_show'] },
          id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
          scheduledAt: { lt: slotEnd },
          // appointment ends after our slot starts: scheduledAt + durationMinutes > scheduledAt_new
        },
      },
      include: {
        equipment: { select: { name: true } },
        appointment: { select: { scheduledAt: true, durationMinutes: true } },
      },
    })

    // Filter to only overlapping appointments
    const overlapping = conflicts.filter((c) => {
      const apptStart = c.appointment.scheduledAt
      const apptEnd = new Date(apptStart.getTime() + c.appointment.durationMinutes * 60 * 1000)
      return scheduledAt < apptEnd && slotEnd > apptStart
    })

    if (overlapping.length > 0) {
      const names = [...new Set(overlapping.map((c) => c.equipment.name))].join(', ')
      throw new AppError(
        `Conflito de equipamento: ${names} já está em uso neste horário`,
        409,
        'EQUIPMENT_CONFLICT',
      )
    }
  }

  private async assertRoomAvailable(
    clinicId: string,
    roomId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeAppointmentId?: string,
  ) {
    const room = await prisma.room.findFirst({ where: { id: roomId, clinicId, active: true } })
    if (!room) throw new AppError('Sala não encontrada ou inativa', 400, 'ROOM_NOT_FOUND')

    const slotEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000)

    const conflicts = await prisma.appointment.findMany({
      where: {
        roomId,
        clinicId,
        status: { notIn: ['cancelled', 'no_show'] },
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        scheduledAt: { lt: slotEnd },
      },
      select: { scheduledAt: true, durationMinutes: true },
    })

    const overlapping = conflicts.filter((c) => {
      const apptEnd = new Date(c.scheduledAt.getTime() + c.durationMinutes * 60 * 1000)
      return scheduledAt < apptEnd && slotEnd > c.scheduledAt
    })

    if (overlapping.length > 0) {
      throw new AppError(
        `Conflito de sala: ${room.name} já está ocupada neste horário`,
        409,
        'ROOM_CONFLICT',
      )
    }
  }

  private async assertSlotAvailable(
    clinicId: string,
    professionalId: string,
    scheduledAt: Date,
    durationMinutes: number,
    dateStr: string,
    _excludeId?: string,
  ) {
    const slotStart = dateToMinutes(scheduledAt)
    const slotEnd = slotStart + durationMinutes

    const [appointments, blockedSlots] = await Promise.all([
      this.repo.getConflictingAppointments(clinicId, professionalId, dateStr),
      this.repo.getBlockedSlotsForDate(clinicId, professionalId, dateStr),
    ])

    const occupied = [
      ...appointments.map((a: { scheduledAt: Date; durationMinutes: number }) => ({
        start: dateToMinutes(a.scheduledAt),
        end: dateToMinutes(a.scheduledAt) + a.durationMinutes,
      })),
      ...blockedSlots.map((b: { startTime: string; endTime: string }) => ({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime),
      })),
    ]

    const conflict = occupied.some((o) => slotStart < o.end && slotEnd > o.start)
    if (conflict) {
      throw new AppError('Time slot is not available', 409, 'SLOT_UNAVAILABLE')
    }
  }
}
