import { prisma } from '../../database/prisma/client'
import type {
  CreateAppointmentDto,
  CreateBlockedSlotDto,
  ListAppointmentsQuery,
  UpdateAppointmentDto,
} from './appointments.dto'

const appointmentInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  professional: { select: { id: true, name: true, speciality: true } },
  service: { select: { id: true, name: true, category: true, durationMinutes: true } },
  equipment: { include: { equipment: { select: { id: true, name: true } } } },
} as const

export class AppointmentsRepository {
  async findAll(clinicId: string, q: ListAppointmentsQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.professionalId) where.professionalId = q.professionalId
    if (q.customerId) where.customerId = q.customerId
    if (q.serviceId) where.serviceId = q.serviceId
    if (q.status) where.status = q.status

    if (q.date) {
      const start = new Date(`${q.date}T00:00:00.000Z`)
      const end = new Date(`${q.date}T23:59:59.999Z`)
      where.scheduledAt = { gte: start, lte: end }
    } else if (q.dateFrom || q.dateTo) {
      const range: Record<string, Date> = {}
      if (q.dateFrom) range.gte = new Date(`${q.dateFrom}T00:00:00.000Z`)
      if (q.dateTo) range.lte = new Date(`${q.dateTo}T23:59:59.999Z`)
      where.scheduledAt = range
    }

    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: q.limit,
      }),
      prisma.appointment.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.appointment.findFirst({
      where: { id, clinicId },
      include: appointmentInclude,
    })
  }

  async create(clinicId: string, dto: CreateAppointmentDto & { durationMinutes: number; price: number }) {
    return prisma.appointment.create({
      data: {
        clinicId,
        customerId: dto.customerId,
        professionalId: dto.professionalId,
        serviceId: dto.serviceId,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        notes: dto.notes,
      },
      include: appointmentInclude,
    })
  }

  async update(_clinicId: string, id: string, dto: UpdateAppointmentDto) {
    return prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.price !== undefined && { price: dto.price }),
        updatedAt: new Date(),
      },
      include: appointmentInclude,
    })
  }

  async transition(
    _clinicId: string,
    id: string,
    status: string,
    extra?: Partial<{ cancellationReason: string; completedAt: Date; cancelledAt: Date }>,
  ) {
    return prisma.appointment.update({
      where: { id },
      data: { status: status as never, ...extra, updatedAt: new Date() },
      include: appointmentInclude,
    })
  }

  // ── Availability ──────────────────────────────────────────────────────────────

  async getConflictingAppointments(
    clinicId: string,
    professionalId: string,
    date: string, // YYYY-MM-DD
  ) {
    const start = new Date(`${date}T00:00:00.000Z`)
    const end = new Date(`${date}T23:59:59.999Z`)
    return prisma.appointment.findMany({
      where: {
        clinicId,
        professionalId,
        scheduledAt: { gte: start, lte: end },
        status: { in: ['draft', 'confirmed', 'in_progress'] },
      },
      select: { scheduledAt: true, durationMinutes: true },
    })
  }

  async getBlockedSlotsForDate(clinicId: string, professionalId: string, date: string) {
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay()
    const dateObj = new Date(date + 'T00:00:00.000Z')

    return prisma.blockedSlot.findMany({
      where: {
        clinicId,
        professionalId,
        OR: [
          { recurrence: 'none', date: dateObj },
          { recurrence: 'daily' },
          { recurrence: 'weekly', dayOfWeek },
        ],
      },
    })
  }

  async getProfessionalWorkingHours(professionalId: string, dayOfWeek: number) {
    return prisma.professionalWorkingHour.findFirst({
      where: { professionalId, dayOfWeek, isAvailable: true },
    })
  }

  async checkProfessionalHasService(professionalId: string, serviceId: string) {
    // If the professional has allServices=true, they perform all services
    const professional = await prisma.professional.findFirst({
      where: { id: professionalId },
      select: { allServices: true },
    })
    if (professional?.allServices) return true

    const ps = await prisma.professionalService.findFirst({
      where: { professionalId, serviceId },
    })
    return !!ps
  }

  // ── Calendar ──────────────────────────────────────────────────────────────────

  async getCalendarAppointments(
    clinicId: string,
    dateFrom: Date,
    dateTo: Date,
    professionalId?: string,
  ) {
    return prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: { gte: dateFrom, lte: dateTo },
        ...(professionalId && { professionalId }),
        status: { notIn: ['cancelled'] },
      },
      include: appointmentInclude,
      orderBy: { scheduledAt: 'asc' },
    })
  }

  async getCalendarBlockedSlots(
    clinicId: string,
    dateFrom: Date,
    dateTo: Date,
    professionalId?: string,
  ) {
    // Collect all days in range
    const days: string[] = []
    const cur = new Date(dateFrom)
    while (cur <= dateTo) {
      days.push(cur.toISOString().slice(0, 10))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    const dayOfWeeks = [...new Set(days.map((d) => new Date(d + 'T12:00:00Z').getUTCDay()))]
    const dateDates = days.map((d) => new Date(d + 'T00:00:00.000Z'))

    return prisma.blockedSlot.findMany({
      where: {
        clinicId,
        ...(professionalId && { professionalId }),
        OR: [
          { recurrence: 'none', date: { in: dateDates } },
          { recurrence: 'daily' },
          { recurrence: 'weekly', dayOfWeek: { in: dayOfWeeks } },
        ],
      },
      include: { professional: { select: { id: true, name: true } } },
    })
  }

  // ── Blocked Slots CRUD ────────────────────────────────────────────────────────

  async createBlockedSlot(clinicId: string, dto: CreateBlockedSlotDto) {
    return prisma.blockedSlot.create({
      data: {
        clinicId,
        professionalId: dto.professionalId,
        reason: dto.reason,
        date: dto.date ? new Date(dto.date + 'T00:00:00.000Z') : null,
        startTime: dto.startTime,
        endTime: dto.endTime,
        recurrence: dto.recurrence,
        dayOfWeek: dto.dayOfWeek ?? null,
      },
    })
  }

  async listBlockedSlots(clinicId: string, professionalId?: string) {
    return prisma.blockedSlot.findMany({
      where: { clinicId, ...(professionalId && { professionalId }) },
      orderBy: { createdAt: 'desc' },
      include: { professional: { select: { id: true, name: true } } },
    })
  }

  async deleteBlockedSlot(clinicId: string, id: string) {
    return prisma.blockedSlot.deleteMany({ where: { id, clinicId } })
  }
}
