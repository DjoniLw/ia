import { prisma } from '../../database/prisma/client'
import type { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from './customers.dto'

export class CustomersRepository {
  async findAll(clinicId: string, q: ListCustomersQuery) {
    const skip = (q.page - 1) * q.limit

    // When `search` is provided, match name OR document (CPF) OR phone with OR logic.
    // Individual field filters (name/email/phone/document) are still supported as AND conditions.
    const searchOr = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' as const } },
            { document: { contains: q.search, mode: 'insensitive' as const } },
            { phone: { contains: q.search } },
          ],
        }
      : undefined

    const where = {
      clinicId,
      deletedAt: null,
      ...(searchOr ?? {
        ...(q.name && { name: { contains: q.name, mode: 'insensitive' as const } }),
        ...(q.email && { email: { contains: q.email, mode: 'insensitive' as const } }),
        ...(q.phone && { phone: { contains: q.phone } }),
        ...(q.document && { document: q.document }),
      }),
    }
    const [items, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take: q.limit, orderBy: { name: 'asc' } }),
      prisma.customer.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.customer.findFirst({ where: { id, clinicId, deletedAt: null } })
  }

  async findByEmail(clinicId: string, email: string) {
    return prisma.customer.findFirst({ where: { clinicId, email, deletedAt: null } })
  }

  async findByDocument(clinicId: string, document: string) {
    return prisma.customer.findFirst({ where: { clinicId, document, deletedAt: null } })
  }

  async create(clinicId: string, data: CreateCustomerDto) {
    return prisma.customer.create({
      data: {
        clinicId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        document: data.document,
        notes: data.notes,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        address: data.address as object | undefined,
        metadata: {
          phone2: data.phone2 ?? null,
          rg: data.rg ?? null,
          gender: data.gender ?? null,
          occupation: data.occupation ?? null,
          howFound: data.howFound ?? null,
          anamnesis: data.anamnesis ?? null,
        } as object,
      },
    })
  }

  async update(clinicId: string, id: string, data: UpdateCustomerDto) {
    const existing = await this.findById(clinicId, id)
    const existingMeta = (existing?.metadata as Record<string, unknown> | null) ?? {}

    return prisma.customer.update({
      where: { id, clinicId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        email: data.email,
        phone: data.phone,
        document: data.document,
        notes: data.notes,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        address: data.address as object | undefined,
        metadata: {
          ...existingMeta,
          phone2: data.phone2 ?? existingMeta.phone2 ?? null,
          rg: data.rg ?? existingMeta.rg ?? null,
          gender: data.gender ?? existingMeta.gender ?? null,
          occupation: data.occupation ?? existingMeta.occupation ?? null,
          howFound: data.howFound ?? existingMeta.howFound ?? null,
          anamnesis: data.anamnesis ?? existingMeta.anamnesis ?? null,
        } as object,
      },
    })
  }

  async softDelete(clinicId: string, id: string) {
    return prisma.customer.update({
      where: { id, clinicId },
      data: { deletedAt: new Date() },
    })
  }
}
