import { prisma } from '../../database/prisma/client'
import type { CreateClinicalRecordDto, ListClinicalRecordsQuery, UpdateClinicalRecordDto } from './clinical.dto'

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
        performedAt: data.performedAt ? new Date(data.performedAt) : null,
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

  async findById(clinicId: string, id: string) {
    return prisma.clinicalRecord.findFirst({
      where: { id, clinicId },
      include: { professional: { select: { id: true, name: true } } },
    })
  }

  async update(clinicId: string, id: string, data: UpdateClinicalRecordDto) {
    return prisma.clinicalRecord.update({
      where: { id, clinicId }, // garantir isolamento por clínica (prevenir IDOR cross-tenant)
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.type !== undefined && { type: data.type }),
        performedAt: data.performedAt !== undefined
          ? (data.performedAt ? new Date(data.performedAt) : null)
          : undefined,
      },
      include: { professional: { select: { id: true, name: true } } },
    })
  }
}
