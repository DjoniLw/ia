import { prisma } from '../../database/prisma/client'
import type {
  CreateProfessionalDto,
  ListProfessionalsQuery,
  UpdateProfessionalDto,
} from './professionals.dto'

export class ProfessionalsRepository {
  async findAll(clinicId: string, q: ListProfessionalsQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      deletedAt: null,
      ...(q.active !== undefined && { active: q.active }),
      ...(q.name && { name: { contains: q.name, mode: 'insensitive' as const } }),
    }
    const [items, total] = await Promise.all([
      prisma.professional.findMany({
        where,
        skip,
        take: q.limit,
        orderBy: { name: 'asc' },
        include: { services: { include: { service: true } } },
      }),
      prisma.professional.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.professional.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        services: { include: { service: true } },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
      },
    })
  }

  async findByEmail(clinicId: string, email: string) {
    return prisma.professional.findFirst({ where: { clinicId, email, deletedAt: null } })
  }

  async create(clinicId: string, data: CreateProfessionalDto) {
    return prisma.professional.create({ data: { clinicId, ...data } })
  }

  async update(clinicId: string, id: string, data: UpdateProfessionalDto) {
    return prisma.professional.update({ where: { id, clinicId }, data })
  }

  async softDelete(clinicId: string, id: string) {
    return prisma.professional.update({
      where: { id, clinicId },
      data: { deletedAt: new Date(), active: false },
    })
  }

  async getWorkingHours(clinicId: string, professionalId: string) {
    return prisma.professionalWorkingHour.findMany({
      where: { professionalId, clinicId },
      orderBy: { dayOfWeek: 'asc' },
    })
  }

  async setWorkingHours(
    clinicId: string,
    professionalId: string,
    hours: Array<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }>,
  ) {
    return prisma.$transaction(
      hours.map((h) =>
        prisma.professionalWorkingHour.upsert({
          where: { professionalId_dayOfWeek: { professionalId, dayOfWeek: h.dayOfWeek } },
          create: { clinicId, professionalId, ...h },
          update: { startTime: h.startTime, endTime: h.endTime, isAvailable: h.isAvailable },
        }),
      ),
    )
  }

  async getServices(clinicId: string, professionalId: string) {
    return prisma.professionalService.findMany({
      where: { professionalId, clinicId },
      include: { service: true },
    })
  }

  async assignServices(clinicId: string, professionalId: string, serviceIds: string[], allServices?: boolean) {
    // Replace all assigned services and optionally set allServices flag
    return prisma.$transaction([
      prisma.professionalService.deleteMany({ where: { professionalId, clinicId } }),
      prisma.professionalService.createMany({
        data: serviceIds.map((serviceId) => ({ clinicId, professionalId, serviceId })),
        skipDuplicates: true,
      }),
      ...(allServices !== undefined
        ? [prisma.professional.update({ where: { id: professionalId }, data: { allServices } })]
        : []),
    ])
  }
}
