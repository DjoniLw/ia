import { prisma } from '../../database/prisma/client'
import type { CreateClinicalRecordDto, ListClinicalRecordsQuery } from './clinical.dto'

export class ClinicalRepository {
  async create(clinicId: string, data: CreateClinicalRecordDto) {
    return prisma.clinicalRecord.create({
      data: {
        clinicId,
        customerId: data.customerId,
        professionalId: data.professionalId ?? null,
        title: data.title,
        content: data.content,
        type: data.type ?? 'note',
      },
      include: {
        professional: { select: { id: true, name: true } },
      },
    })
  }

  async findAll(clinicId: string, q: ListClinicalRecordsQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      ...(q.customerId && { customerId: q.customerId }),
      ...(q.type && { type: q.type }),
    }
    const [items, total] = await Promise.all([
      prisma.clinicalRecord.findMany({
        where,
        skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { select: { id: true, name: true } },
        },
      }),
      prisma.clinicalRecord.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }
}
