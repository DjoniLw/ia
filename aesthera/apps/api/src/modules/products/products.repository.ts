import { prisma } from '../../database/prisma/client'
import type { CreateProductDto, CreateSaleDto, ListProductsQuery, ListSalesQuery, UpdateProductDto } from './products.dto'

export class ProductsRepository {
  async findAll(clinicId: string, q: ListProductsQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      deletedAt: null,
      ...(q.name && { name: { contains: q.name, mode: 'insensitive' as const } }),
      ...(q.category && { category: q.category }),
      ...(q.active !== undefined && { active: q.active }),
      ...(q.lowStock && { stock: { lte: prisma.product.fields.minStock } }),
    }
    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: q.limit, orderBy: { name: 'asc' } }),
      prisma.product.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.product.findFirst({ where: { id, clinicId, deletedAt: null } })
  }

  async create(clinicId: string, data: CreateProductDto) {
    return prisma.product.create({
      data: {
        clinicId,
        name: data.name,
        description: data.description,
        category: data.category,
        brand: data.brand,
        sku: data.sku,
        barcode: data.barcode,
        price: data.price,
        costPrice: data.costPrice,
        stock: data.stock ?? 0,
        minStock: data.minStock ?? 0,
        unit: data.unit ?? 'un',
        imageUrl: data.imageUrl,
      },
    })
  }

  async update(clinicId: string, id: string, data: UpdateProductDto) {
    return prisma.product.update({
      where: { id, clinicId },
      data,
    })
  }

  async softDelete(clinicId: string, id: string) {
    return prisma.product.update({
      where: { id, clinicId },
      data: { deletedAt: new Date() },
    })
  }

  // ── Sales ──────────────────────────────────────────────────────────────────

  async createSale(clinicId: string, data: CreateSaleDto, unitPrice: number) {
    const totalPrice = unitPrice * data.quantity - (data.discount ?? 0)
    const [sale] = await prisma.$transaction([
      prisma.productSale.create({
        data: {
          clinicId,
          productId: data.productId,
          customerId: data.customerId,
          quantity: data.quantity,
          unitPrice,
          totalPrice,
          discount: data.discount ?? 0,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
        include: {
          product: { select: { id: true, name: true, unit: true } },
          customer: { select: { id: true, name: true } },
        },
      }),
      prisma.product.update({
        where: { id: data.productId, clinicId },
        data: { stock: { decrement: data.quantity } },
      }),
    ])
    return sale
  }

  async listSales(clinicId: string, q: ListSalesQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      ...(q.productId && { productId: q.productId }),
      ...(q.customerId && { customerId: q.customerId }),
      ...(q.paymentMethod && { paymentMethod: q.paymentMethod }),
      ...(q.search && {
        OR: [
          { product: { name: { contains: q.search, mode: 'insensitive' as const } } },
          { customer: { name: { contains: q.search, mode: 'insensitive' as const } } },
        ],
      }),
      ...((q.from || q.to) && {
        soldAt: {
          ...(q.from && { gte: new Date(q.from + 'T00:00:00Z') }),
          ...(q.to && { lte: new Date(q.to + 'T23:59:59Z') }),
        },
      }),
    }
    const [items, total] = await Promise.all([
      prisma.productSale.findMany({
        where,
        skip,
        take: q.limit,
        orderBy: { soldAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, unit: true } },
          customer: { select: { id: true, name: true } },
        },
      }),
      prisma.productSale.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }
}
