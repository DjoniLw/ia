import { prisma } from '../../database/prisma/client'
import type { CreatePackageDto, ListCustomerPackagesQuery, ListPackagesQuery, ListSoldPackagesQuery, UpdatePackageDto } from './packages.dto'

const packageInclude = {
  items: {
    include: { service: { select: { id: true, name: true, category: true, durationMinutes: true } } },
  },
} as const

export class PackagesRepository {
  async findAll(clinicId: string, q: ListPackagesQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.active !== undefined) where.active = q.active
    if (q.name) where.name = { contains: q.name, mode: 'insensitive' }

    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.servicePackage.findMany({
        where,
        include: packageInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.servicePackage.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.servicePackage.findFirst({
      where: { id, clinicId },
      include: packageInclude,
    })
  }

  async create(clinicId: string, dto: CreatePackageDto) {
    return prisma.servicePackage.create({
      data: {
        clinicId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        validityDays: dto.validityDays,
        items: {
          create: dto.items.map((item) => ({
            serviceId: item.serviceId,
            clinicId,
            quantity: item.quantity,
          })),
        },
      },
      include: packageInclude,
    })
  }

  async update(_clinicId: string, id: string, dto: UpdatePackageDto) {
    return prisma.servicePackage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.validityDays !== undefined && { validityDays: dto.validityDays }),
        ...(dto.active !== undefined && { active: dto.active }),
        updatedAt: new Date(),
      },
      include: packageInclude,
    })
  }

  async findCustomerPackages(clinicId: string, customerId: string, q?: ListCustomerPackagesQuery) {
    const where: Record<string, unknown> = { clinicId, customerId }

    if (q?.packageName) {
      where.package = { name: { contains: q.packageName, mode: 'insensitive' } }
    }
    if (q?.purchasedFrom || q?.purchasedUntil) {
      where.purchasedAt = {
        ...(q.purchasedFrom ? { gte: new Date(q.purchasedFrom) } : {}),
        ...(q.purchasedUntil ? { lte: new Date(q.purchasedUntil + 'T23:59:59.999Z') } : {}),
      }
    }

    const packages = await prisma.customerPackage.findMany({
      where,
      include: {
        package: { include: packageInclude },
        sessions: { orderBy: { usedAt: 'desc' } },
      },
      orderBy: { purchasedAt: 'desc' },
    })

    // Filter by derived status if requested
    if (q?.status) {
      const now = new Date()
      return packages.filter((p) => {
        const isExpired = p.expiresAt !== null && p.expiresAt < now
        const allSessionsDone = p.sessions.every(
          (s) => s.status === 'FINALIZADO' || s.status === 'EXPIRADO',
        )
        if (q.status === 'expirado') return isExpired
        if (q.status === 'esgotado') return !isExpired && allSessionsDone
        // ativo = at least one ABERTO session, not expired
        return !isExpired && p.sessions.some((s) => s.status === 'ABERTO')
      })
    }

    return packages
  }

  async findSoldPackages(clinicId: string, q: ListSoldPackagesQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.customerId) where.customerId = q.customerId
    if (q.purchasedFrom || q.purchasedUntil) {
      where.purchasedAt = {
        ...(q.purchasedFrom ? { gte: new Date(q.purchasedFrom) } : {}),
        ...(q.purchasedUntil ? { lte: new Date(q.purchasedUntil + 'T23:59:59.999Z') } : {}),
      }
    }

    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.customerPackage.findMany({
        where,
        include: {
          package: { include: packageInclude },
          customer: { select: { id: true, name: true, phone: true } },
          sessions: { orderBy: { usedAt: 'desc' } },
        },
        orderBy: { purchasedAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.customerPackage.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findCustomerPackageById(clinicId: string, id: string) {
    return prisma.customerPackage.findFirst({
      where: { id, clinicId },
      include: {
        package: { include: packageInclude },
        sessions: { orderBy: { usedAt: 'desc' } },
      },
    })
  }

  async createCustomerPackage(data: {
    clinicId: string
    customerId: string
    packageId: string
    walletEntryId?: string
    billingId?: string
    expiresAt?: Date
  }) {
    return prisma.customerPackage.create({
      data: {
        clinicId: data.clinicId,
        customerId: data.customerId,
        packageId: data.packageId,
        walletEntryId: data.walletEntryId,
        billingId: data.billingId,
        expiresAt: data.expiresAt,
      },
      include: {
        package: { include: packageInclude },
        sessions: true,
      },
    })
  }

  async createSessions(data: Array<{
    clinicId: string
    customerPackageId: string
    serviceId: string
  }>) {
    return prisma.customerPackageSession.createMany({ data })
  }

  async findSessionById(clinicId: string, id: string) {
    return prisma.customerPackageSession.findFirst({
      where: { id, clinicId },
      include: { customerPackage: true },
    })
  }

  async redeemSession(id: string, appointmentId?: string) {
    return prisma.customerPackageSession.update({
      where: { id },
      data: {
        status: 'FINALIZADO',
        usedAt: new Date(),
        ...(appointmentId && { appointmentId }),
      },
    })
  }

  /** Link a session to an appointment — set status=AGENDADO */
  async linkSession(sessionId: string, appointmentId: string) {
    return prisma.customerPackageSession.update({
      where: { id: sessionId },
      data: { appointmentId, status: 'AGENDADO' },
    })
  }

  /** Clear the appointmentId from a session — set status back to ABERTO */
  async unlinkSession(sessionId: string) {
    return prisma.customerPackageSession.update({
      where: { id: sessionId },
      data: { appointmentId: null, status: 'ABERTO' },
    })
  }

  /** Find a session linked to an appointment that has not been used/finalized yet */
  async findLinkedSession(clinicId: string, appointmentId: string) {
    return prisma.customerPackageSession.findFirst({
      where: { clinicId, appointmentId, status: { in: ['AGENDADO'] } },
    })
  }

  /** Find billing for idempotency check by idempotency key */
  async findBillingByIdempotencyKey(clinicId: string, idempotencyKey: string) {
    return prisma.billing.findFirst({
      where: { clinicId, paymentToken: idempotencyKey },
    })
  }

  /** Count customer usages of a specific promotion */
  async countCustomerPromotionUsage(promotionId: string, customerId: string): Promise<number> {
    return prisma.promotionUsage.count({ where: { promotionId, customerId } })
  }
}
