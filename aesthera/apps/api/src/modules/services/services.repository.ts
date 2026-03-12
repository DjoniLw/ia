import { prisma } from '../../database/prisma/client'
import type { CreateServiceDto, ListServicesQuery, UpdateServiceDto } from './services.dto'

export class ServicesRepository {
  async findAll(clinicId: string, q: ListServicesQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      deletedAt: null,
      ...(q.active !== undefined && { active: q.active }),
      ...(q.category && { category: q.category }),
      ...(q.name && { name: { contains: q.name, mode: 'insensitive' as const } }),
    }
    const [items, total] = await Promise.all([
      prisma.service.findMany({ where, skip, take: q.limit, orderBy: { name: 'asc' } }),
      prisma.service.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.service.findFirst({ where: { id, clinicId, deletedAt: null } })
  }

  async create(clinicId: string, data: CreateServiceDto) {
    return prisma.service.create({ data: { clinicId, ...data } })
  }

  async update(clinicId: string, id: string, data: UpdateServiceDto) {
    return prisma.service.update({ where: { id, clinicId }, data })
  }

  async softDelete(clinicId: string, id: string) {
    return prisma.service.update({
      where: { id, clinicId },
      data: { deletedAt: new Date(), active: false },
    })
  }
}
