import { prisma } from '../../database/prisma/client'
import type { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from './customers.dto'

export class CustomersRepository {
  async findAll(clinicId: string, q: ListCustomersQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      deletedAt: null,
      ...(q.name && { name: { contains: q.name, mode: 'insensitive' as const } }),
      ...(q.email && { email: { contains: q.email, mode: 'insensitive' as const } }),
      ...(q.phone && { phone: { contains: q.phone } }),
      ...(q.document && { document: q.document }),
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
      },
    })
  }

  async update(clinicId: string, id: string, data: UpdateCustomerDto) {
    return prisma.customer.update({
      where: { id, clinicId },
      data: {
        ...data,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        address: data.address as object | undefined,
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
