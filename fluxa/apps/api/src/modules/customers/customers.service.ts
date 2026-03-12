import { prisma } from '../../database/prisma/client'
import { NotFoundError, ConflictError } from '../../shared/errors/app-error'
import { generateId } from '../../shared/utils/id'
import { CreateCustomerDto, UpdateCustomerDto, ListCustomersDto } from './customers.dto'

export class CustomersService {
  async create(companyId: string, data: CreateCustomerDto) {
    // Check for duplicates
    if (data.email) {
      const existing = await prisma.customer.findUnique({
        where: {
          companyId_email: { companyId, email: data.email },
        },
      })
      if (existing) throw new ConflictError('Email already registered for this company')
    }

    if (data.document) {
      const existing = await prisma.customer.findUnique({
        where: {
          companyId_document: { companyId, document: data.document },
        },
      })
      if (existing) throw new ConflictError('Document already registered for this company')
    }

    if (data.externalId) {
      const existing = await prisma.customer.findUnique({
        where: {
          companyId_externalId: { companyId, externalId: data.externalId },
        },
      })
      if (existing) throw new ConflictError('External ID already registered for this company')
    }

    return prisma.customer.create({
      data: {
        id: generateId(),
        companyId,
        name: data.name,
        externalId: data.externalId,
        email: data.email,
        document: data.document,
        phone: data.phone,
        address: data.address ? JSON.parse(JSON.stringify(data.address)) : null,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
      },
    })
  }

  async getById(companyId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        companyId,
        deletedAt: null,
      },
    })

    if (!customer) throw new NotFoundError('Customer')

    return customer
  }

  async list(companyId: string, params: ListCustomersDto) {
    const skip = (params.page - 1) * params.limit

    const where = {
      companyId,
      deletedAt: null,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { document: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
      }),
      prisma.customer.count({ where }),
    ])

    return {
      data: customers,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    }
  }

  async update(companyId: string, customerId: string, data: UpdateCustomerDto) {
    await this.getById(companyId, customerId) // Validate existence

    if (data.email) {
      const existing = await prisma.customer.findFirst({
        where: {
          companyId,
          email: data.email,
          id: { not: customerId },
          deletedAt: null,
        },
      })
      if (existing) throw new ConflictError('Email already registered for this company')
    }

    if (data.document) {
      const existing = await prisma.customer.findFirst({
        where: {
          companyId,
          document: data.document,
          id: { not: customerId },
          deletedAt: null,
        },
      })
      if (existing) throw new ConflictError('Document already registered for this company')
    }

    return prisma.customer.update({
      where: { id: customerId },
      data: {
        name: data.name,
        email: data.email,
        document: data.document,
        phone: data.phone,
        address: data.address ? JSON.parse(JSON.stringify(data.address)) : undefined,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    })
  }

  async delete(companyId: string, customerId: string) {
    await this.getById(companyId, customerId) // Validate existence

    return prisma.customer.update({
      where: { id: customerId },
      data: { deletedAt: new Date() },
    })
  }

  async search(companyId: string, query: string) {
    return prisma.customer.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { document: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    })
  }
}

export const customersService = new CustomersService()
