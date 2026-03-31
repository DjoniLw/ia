import { prisma } from '../../database/prisma/client'
import type { CreatePromotionDto, ListPromotionsQuery, UpdatePromotionDto } from './promotions.dto'

export class PromotionsRepository {
  async findAll(clinicId: string, q: ListPromotionsQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.status) where.status = q.status
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ]
    }
    if (q.serviceId) {
      where.applicableServiceIds = { has: q.serviceId }
    }

    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.promotion.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.promotion.findFirst({
      where: { id, clinicId },
      include: { usages: { orderBy: { usedAt: 'desc' }, take: 50 } },
    })
  }

  async findByCode(clinicId: string, code: string) {
    return prisma.promotion.findFirst({
      where: { clinicId, code },
    })
  }

  async findActiveForService(clinicId: string, serviceId: string) {
    return prisma.promotion.findMany({
      where: {
        clinicId,
        status: 'active',
        applicableServiceIds: { has: serviceId },
        validFrom: { lte: new Date() },
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
      orderBy: { discountValue: 'desc' },
    })
  }

  async create(clinicId: string, dto: CreatePromotionDto) {
    return prisma.promotion.create({
      data: {
        clinicId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUses: dto.maxUses,
        maxUsesPerCustomer: dto.maxUsesPerCustomer,
        minAmount: dto.minAmount,
        applicableServiceIds: dto.applicableServiceIds,
        applicableProductIds: dto.applicableProductIds,
        validFrom: new Date(dto.validFrom),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        status: 'active',
      },
    })
  }

  async update(_clinicId: string, id: string, dto: UpdatePromotionDto) {
    return prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.maxUsesPerCustomer !== undefined && { maxUsesPerCustomer: dto.maxUsesPerCustomer }),
        ...(dto.applicableServiceIds !== undefined && { applicableServiceIds: dto.applicableServiceIds }),
        ...(dto.applicableProductIds !== undefined && { applicableProductIds: dto.applicableProductIds }),
        ...(dto.validUntil !== undefined && {
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        }),
        updatedAt: new Date(),
      },
    })
  }

  async toggleStatus(id: string, active: boolean) {
    return prisma.promotion.update({
      where: { id },
      data: { status: active ? 'active' : 'inactive', updatedAt: new Date() },
    })
  }

  async incrementUsage(id: string) {
    return prisma.promotion.update({
      where: { id },
      data: { usesCount: { increment: 1 }, updatedAt: new Date() },
    })
  }

  async createUsage(data: {
    clinicId: string
    promotionId: string
    customerId: string
    billingId?: string
    saleId?: string
    discountAmount: number
  }) {
    return prisma.promotionUsage.create({ data })
  }

  async countCustomerUsage(promotionId: string, customerId: string): Promise<number> {
    return prisma.promotionUsage.count({ where: { promotionId, customerId } })
  }
}
