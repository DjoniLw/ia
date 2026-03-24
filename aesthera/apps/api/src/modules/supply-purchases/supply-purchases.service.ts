import { prisma } from '../../database/prisma/client'
import { AppError } from '../../shared/errors/app-error'
import type { CreateSupplyPurchaseDto, ListSupplyPurchasesQuery } from './supply-purchases.dto'

const PURCHASE_INCLUDE = {
  supply: {
    select: {
      id: true,
      name: true,
      unit: true,
      stock: true,
      minStock: true,
      active: true,
    },
  },
} as const

function purchaseNotFoundError() {
  return new AppError('Compra de insumo não encontrada.', 404, 'SUPPLY_PURCHASE_NOT_FOUND')
}

function supplyNotFoundError() {
  return new AppError('Insumo não encontrado.', 404, 'SUPPLY_NOT_FOUND')
}

export class SupplyPurchasesService {
  async list(clinicId: string, q: ListSupplyPurchasesQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      ...(q.supplyId && { supplyId: q.supplyId }),
      ...(q.supplierName && { supplierName: { contains: q.supplierName, mode: 'insensitive' as const } }),
      ...((q.from || q.to) && {
        purchasedAt: {
          ...(q.from && { gte: new Date(`${q.from}T00:00:00.000Z`) }),
          ...(q.to && { lte: new Date(`${q.to}T23:59:59.999Z`) }),
        },
      }),
    }

    const [items, total] = await Promise.all([
      prisma.supplyPurchase.findMany({
        where,
        include: PURCHASE_INCLUDE,
        skip,
        take: q.limit,
        orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.supplyPurchase.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit }
  }

  async get(clinicId: string, id: string) {
    const purchase = await prisma.supplyPurchase.findFirst({
      where: { id, clinicId },
      include: PURCHASE_INCLUDE,
    })

    if (!purchase) throw purchaseNotFoundError()
    return purchase
  }

  async create(clinicId: string, dto: CreateSupplyPurchaseDto) {
    return prisma.$transaction(async (tx) => {
      const supply = await tx.supply.findFirst({
        where: { id: dto.supplyId, clinicId, deletedAt: null },
      })

      if (!supply) throw supplyNotFoundError()

      const stockIncrement = Math.floor(dto.purchaseQty * dto.conversionFactor)
      const totalCost = Math.round(dto.unitCost * dto.purchaseQty)

      await tx.supply.update({
        where: { id: supply.id },
        data: { stock: { increment: stockIncrement } },
      })

      const purchase = await tx.supplyPurchase.create({
        data: {
          clinicId,
          supplyId: supply.id,
          supplierName: dto.supplierName?.trim() || null,
          purchaseUnit: dto.purchaseUnit.trim(),
          purchaseQty: dto.purchaseQty,
          conversionFactor: dto.conversionFactor,
          stockIncrement,
          unitCost: dto.unitCost,
          totalCost,
          notes: dto.notes?.trim() || null,
          purchasedAt: new Date(dto.purchasedAt),
        },
        include: PURCHASE_INCLUDE,
      })

      // Auto-create AccountsPayable entry inside the same transaction (due date = purchase date)
      await tx.accountsPayable.create({
        data: {
          clinicId,
          description: `Compra de Insumo — ${supply.name}`,
          supplierName: purchase.supplierName ?? null,
          category: 'Insumos',
          amount: purchase.totalCost,
          dueDate: purchase.purchasedAt,
          status: 'PENDING',
          originType: 'supply_purchase',
          originReference: purchase.id,
        },
      })

      return purchase
    })
  }

  async delete(clinicId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.supplyPurchase.findFirst({
        where: { id, clinicId },
        include: { supply: { select: { id: true, name: true, unit: true } } },
      })

      if (!purchase) throw purchaseNotFoundError()

      const reversal = await tx.supply.updateMany({
        where: {
          id: purchase.supplyId,
          clinicId,
          stock: { gte: purchase.stockIncrement },
        },
        data: { stock: { decrement: purchase.stockIncrement } },
      })

      if (reversal.count === 0) {
        const currentSupply = await tx.supply.findFirst({
          where: { id: purchase.supplyId, clinicId },
          select: { stock: true, unit: true },
        })

        throw new AppError(
          currentSupply
            ? `Não é possível cancelar esta compra porque o estoque atual (${currentSupply.stock} ${currentSupply.unit}) é menor que o estorno necessário (${purchase.stockIncrement} ${currentSupply.unit}).`
            : 'Não foi possível cancelar esta compra porque o insumo não está disponível para estorno.',
          409,
          'INSUFFICIENT_STOCK_FOR_REVERSAL',
        )
      }

      await tx.supplyPurchase.delete({ where: { id: purchase.id } })

      return { message: 'Compra cancelada com sucesso' }
    })
  }
}

export const supplyPurchasesService = new SupplyPurchasesService()