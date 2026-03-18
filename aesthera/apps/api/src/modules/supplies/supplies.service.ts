import { prisma } from '../../database/prisma/client'
import { AppError, NotFoundError } from '../../shared/errors/app-error'
import type { AssignSuppliesDto, CreateSupplyDto, ListSuppliesQuery, UpdateSupplyDto } from './supplies.dto'

export class SuppliesService {
  async list(clinicId: string, q: ListSuppliesQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      deletedAt: null,
      ...(q.active !== undefined && { active: q.active }),
      ...(q.name && { name: { contains: q.name, mode: 'insensitive' as const } }),
    }
    const [items, total] = await Promise.all([
      prisma.supply.findMany({ where, skip, take: q.limit, orderBy: { name: 'asc' } }),
      prisma.supply.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async get(clinicId: string, id: string) {
    const supply = await prisma.supply.findFirst({ where: { id, clinicId, deletedAt: null } })
    if (!supply) throw new NotFoundError('Supply not found')
    return supply
  }

  async create(clinicId: string, dto: CreateSupplyDto) {
    const existing = await prisma.supply.findFirst({
      where: { clinicId, name: { equals: dto.name, mode: 'insensitive' }, deletedAt: null },
    })
    if (existing) throw new AppError('Insumo com esse nome já existe', 409, 'SUPPLY_EXISTS')
    return prisma.supply.create({ data: { clinicId, ...dto } })
  }

  async update(clinicId: string, id: string, dto: UpdateSupplyDto) {
    await this.get(clinicId, id)
    return prisma.supply.update({ where: { id }, data: dto })
  }

  async delete(clinicId: string, id: string) {
    await this.get(clinicId, id)

    // Prevent deletion if the supply is linked to any active service
    const linkedService = await prisma.serviceSupply.findFirst({
      where: { supplyId: id, clinicId, service: { deletedAt: null } },
      include: { service: { select: { name: true } } },
    })
    if (linkedService) {
      throw new AppError(
        `Este insumo está vinculado ao serviço "${linkedService.service.name}" e não pode ser removido.`,
        409,
        'SUPPLY_IN_USE',
      )
    }

    await prisma.supply.update({ where: { id }, data: { deletedAt: new Date(), active: false } })
    return { message: 'Supply deleted' }
  }

  // ── Service ↔ Supply assignments ──────────────────────────────────────────────

  async getServiceSupplies(clinicId: string, serviceId: string) {
    return prisma.serviceSupply.findMany({
      where: { clinicId, serviceId },
      include: { supply: true },
      orderBy: { supply: { name: 'asc' } },
    })
  }

  async assignServiceSupplies(clinicId: string, serviceId: string, dto: AssignSuppliesDto) {
    // Verify service belongs to clinic
    const service = await prisma.service.findFirst({ where: { id: serviceId, clinicId, deletedAt: null } })
    if (!service) throw new NotFoundError('Service not found')

    return prisma.$transaction([
      prisma.serviceSupply.deleteMany({ where: { serviceId, clinicId } }),
      prisma.serviceSupply.createMany({
        data: dto.supplies.map((s) => ({
          serviceId,
          supplyId: s.supplyId,
          clinicId,
          quantity: s.quantity,
          usageUnit: s.usageUnit ?? null,
          conversionFactor: s.conversionFactor ?? 1,
        })),
        skipDuplicates: true,
      }),
    ])
  }
}

export const suppliesService = new SuppliesService()
