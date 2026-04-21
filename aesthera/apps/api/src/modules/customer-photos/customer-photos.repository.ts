import { prisma } from '../../database/prisma/client'
import type { ListPhotosQueryDto, PhotoCategory } from './customer-photos.dto'

const PHOTO_SELECT = {
  id: true,
  clinicId: true,
  customerId: true,
  measurementSessionId: true,
  name: true,
  mimeType: true,
  size: true,
  storageKey: true,
  category: true,
  takenAt: true,
  bodyRegion: true,
  notes: true,
  uploadedAt: true,
  uploadedById: true,
  uploadedByProfessionalId: true,
  deletedAt: true,
  uploadedByProfessional: {
    select: { id: true, name: true },
  },
} as const

// ─── Galeria ─────────────────────────────────────────────────────────────────

export class CustomerPhotosRepository {
  async findCustomerInClinic(customerId: string, clinicId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
      select: {
        id: true,
        clinicId: true,
        bodyDataConsentAt: true,
      },
    })
  }

  async findSessionInClinic(sessionId: string, clinicId: string, customerId: string) {
    return prisma.measurementSession.findFirst({
      where: { id: sessionId, clinicId, customerId },
      select: { id: true },
    })
  }

  async createPending(params: {
    clinicId: string
    customerId: string
    storageKey: string
    name: string
    mimeType: string
    size: number
    category: PhotoCategory
    uploadedById: string
    uploadedByProfessionalId?: string
    takenAt?: Date
    bodyRegion?: string
    notes?: string
    measurementSessionId?: string
  }) {
    return prisma.customerFile.create({
      data: {
        clinicId: params.clinicId,
        customerId: params.customerId,
        storageKey: params.storageKey,
        name: params.name,
        mimeType: params.mimeType,
        size: params.size,
        category: params.category,
        status: 'CONFIRMED',
        uploadedById: params.uploadedById,
        uploadedByProfessionalId: params.uploadedByProfessionalId ?? null,
        takenAt: params.takenAt ?? null,
        bodyRegion: params.bodyRegion ?? null,
        notes: params.notes ?? null,
        measurementSessionId: params.measurementSessionId ?? null,
      },
      select: PHOTO_SELECT,
    })
  }

  async findMany(clinicId: string, customerId: string, query: ListPhotosQueryDto) {
    const {
      category,
      bodyRegion,
      takenAtFrom,
      takenAtTo,
      page,
      limit,
    } = query

    const categories: PhotoCategory[] = category
      ? [category]
      : ['BEFORE_PHOTO', 'AFTER_PHOTO', 'PROGRESS_PHOTO', 'GALLERY_PHOTO']

    const [items, total] = await prisma.$transaction([
      prisma.customerFile.findMany({
        where: {
          customer: { clinicId },
          customerId,
          category: { in: categories },
          deletedAt: null,
          ...(bodyRegion && { bodyRegion }),
          ...(takenAtFrom || takenAtTo
            ? {
                takenAt: {
                  ...(takenAtFrom && { gte: new Date(takenAtFrom) }),
                  ...(takenAtTo && { lte: new Date(takenAtTo + 'T23:59:59.999Z') }),
                },
              }
            : {}),
        },
        orderBy: [{ takenAt: 'desc' }, { uploadedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: PHOTO_SELECT,
      }),
      prisma.customerFile.count({
        where: {
          customer: { clinicId },
          customerId,
          category: { in: categories },
          deletedAt: null,
          ...(bodyRegion && { bodyRegion }),
          ...(takenAtFrom || takenAtTo
            ? {
                takenAt: {
                  ...(takenAtFrom && { gte: new Date(takenAtFrom) }),
                  ...(takenAtTo && { lte: new Date(takenAtTo + 'T23:59:59.999Z') }),
                },
              }
            : {}),
        },
      }),
    ])

    return { items, total, page, limit }
  }

  async findById(id: string, clinicId: string, customerId: string) {
    return prisma.customerFile.findFirst({
      where: { id, customerId, customer: { clinicId }, deletedAt: null },
      select: PHOTO_SELECT,
    })
  }

  async softDelete(
    id: string,
    clinicId: string,
    customerId: string,
    deletedByUserId: string,
    deletionReason: string,
  ) {
    const result = await prisma.customerFile.updateMany({
      where: { id, customerId, customer: { clinicId }, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedByUserId,
        deletionReason,
      },
    })
    if (result.count === 0) return null
    return prisma.customerFile.findFirst({
      where: { id },
      select: { id: true, deletedAt: true },
    })
  }

  // ── Job de limpeza do storage ─────────────────────────────────────────────

  async findPendingStorageDeletion(batchSize = 100) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    return prisma.customerFile.findMany({
      where: {
        deletedAt: { lt: cutoff },
        storageDeletedAt: null,
      },
      select: {
        id: true,
        clinicId: true,
        storageKey: true,
      },
      orderBy: { clinicId: 'asc' },
      take: batchSize,
    })
  }

  async markStorageDeleted(ids: string[]) {
    return prisma.customerFile.updateMany({
      where: { id: { in: ids } },
      data: { storageDeletedAt: new Date() },
    })
  }

  // ── Settings da clínica ───────────────────────────────────────────────────

  async findClinicSettings(clinicId: string) {
    return prisma.clinic.findFirst({
      where: { id: clinicId },
      select: { id: true, settings: true },
    })
  }

  async updateClinicSettings(clinicId: string, patch: Record<string, unknown>) {
    const clinic = await this.findClinicSettings(clinicId)
    const current = (clinic?.settings as Record<string, unknown> | null) ?? {}
    await prisma.clinic.updateMany({
      where: { id: clinicId },
      data: { settings: { ...current, ...patch } },
    })
  }
}
