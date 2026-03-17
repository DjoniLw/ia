import { prisma } from '../../database/prisma/client'
import type { CreatePackageDto, ListPackagesQuery, UpdatePackageDto } from './packages.dto'

const packageInclude = {
  items: {
    include: { service: { select: { id: true, name: true, category: true, durationMinutes: true } } },
  },
} as const

export class PackagesRepository {
  async findAll(clinicId: string, q: ListPackagesQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.active !== undefined) where.active = q.active

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

  async findCustomerPackages(clinicId: string, customerId: string) {
    return prisma.customerPackage.findMany({
      where: { clinicId, customerId },
      include: {
        package: { include: packageInclude },
        sessions: { orderBy: { usedAt: 'desc' } },
      },
      orderBy: { purchasedAt: 'desc' },
    })
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
    expiresAt?: Date
  }) {
    return prisma.customerPackage.create({
      data: {
        clinicId: data.clinicId,
        customerId: data.customerId,
        packageId: data.packageId,
        walletEntryId: data.walletEntryId,
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
        usedAt: new Date(),
        ...(appointmentId && { appointmentId }),
      },
    })
  }
}
