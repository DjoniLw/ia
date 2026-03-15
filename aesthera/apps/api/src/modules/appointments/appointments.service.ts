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

// HH:MM → minutes from midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// DateTime → minutes from midnight (UTC)
function dateToMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export class AppointmentsService {
  private repo = new AppointmentsRepository()

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
    // 1. Load service to copy price + duration
    const service = await prisma.service.findFirst({
      where: { id: dto.serviceId, clinicId, active: true, deletedAt: null },
    })
    if (!service) throw new NotFoundError('Service')

    // 2. Verify professional belongs to clinic and is active
    const professional = await prisma.professional.findFirst({
      where: { id: dto.professionalId, clinicId, active: true, deletedAt: null },
    })
    if (!professional) throw new NotFoundError('Professional')

    // 3. Verify professional is assigned to service
    const hasService = await this.repo.checkProfessionalHasService(dto.professionalId, dto.serviceId)
    if (!hasService) {
      throw new AppError('Professional is not assigned to this service', 400, 'SERVICE_NOT_ASSIGNED')
    }

    // 4. Verify customer belongs to clinic
    const customer = await prisma.customer.findFirst({
      where: { id: dto.customerId, clinicId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer')

    // 5. Check availability (with advisory lock via transaction)
    const scheduledDate = new Date(dto.scheduledAt)
    const dateStr = scheduledDate.toISOString().slice(0, 10)
    const durationMinutes = service.durationMinutes

    await this.assertSlotAvailable(clinicId, dto.professionalId, scheduledDate, durationMinutes, dateStr)

    // 6. Validate equipment IDs and check for conflicts
    if (dto.equipmentIds && dto.equipmentIds.length > 0) {
      await this.assertEquipmentAvailable(clinicId, dto.equipmentIds, scheduledDate, durationMinutes)
    }

    const appointment = await this.repo.create(clinicId, {
      ...dto,
      durationMinutes,
      price: dto.price ?? service.price,
    })

    // 7. Persist equipment associations
    if (dto.equipmentIds && dto.equipmentIds.length > 0) {
      await prisma.appointmentEquipment.createMany({
        data: dto.equipmentIds.map((equipmentId) => ({ appointmentId: appointment.id, equipmentId })),
        skipDuplicates: true,
      })
    }

    return appointment
  }

  async update(clinicId: string, id: string, dto: UpdateAppointmentDto) {
    const a = await this.get(clinicId, id)
    if (!['draft', 'confirmed'].includes(a.status)) {
      throw new AppError('Only draft or confirmed appointments can be rescheduled', 400, 'INVALID_STATUS')
    }

    if (dto.scheduledAt) {
      const scheduledDate = new Date(dto.scheduledAt)
      const dateStr = scheduledDate.toISOString().slice(0, 10)
      await this.assertSlotAvailable(clinicId, a.professionalId, scheduledDate, a.durationMinutes, dateStr, id)

      if (dto.equipmentIds && dto.equipmentIds.length > 0) {
        await this.assertEquipmentAvailable(clinicId, dto.equipmentIds, scheduledDate, a.durationMinutes, id)
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

    // Auto-create billing (idempotent)
    await this.createBillingForAppointment(completed)

    return completed
  }

  async cancel(clinicId: string, id: string, dto: CancelAppointmentDto) {
    const a = await this.get(clinicId, id)
    if (!['draft', 'confirmed'].includes(a.status)) {
      throw new AppError('Only draft or confirmed appointments can be cancelled', 400, 'INVALID_STATUS')
    }
    return this.repo.transition(clinicId, id, 'cancelled', {
      cancellationReason: dto.cancellationReason,
      cancelledAt: new Date(),
    })
  }

  async noShow(clinicId: string, id: string) {
    const a = await this.get(clinicId, id)
    if (a.status !== 'in_progress') {
      throw new AppError('Only in-progress appointments can be marked as no-show', 400, 'INVALID_STATUS')
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
        service: a.service.name,
        price: a.price,
        notes: a.notes,
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
      ...appointments
        .map((a: { scheduledAt: Date; durationMinutes: number }) => ({
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

  private async createBillingForAppointment(appointment: {
    id: string
    clinicId: string
    customerId: string
    price: number
    scheduledAt: Date
  }) {
    // Idempotent: skip if already exists
    const existing = await prisma.billing.findUnique({
      where: { appointmentId: appointment.id },
    })
    if (existing) return existing

    const dueDate = new Date(appointment.scheduledAt)
    dueDate.setUTCDate(dueDate.getUTCDate() + 3)

    const paymentToken = crypto.randomUUID().replace(/-/g, '')

    return prisma.billing.create({
      data: {
        clinicId: appointment.clinicId,
        customerId: appointment.customerId,
        appointmentId: appointment.id,
        amount: appointment.price,
        status: 'pending',
        paymentMethods: ['pix', 'boleto', 'card'],
        paymentToken,
        dueDate,
      },
    })
  }
}
