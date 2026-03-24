import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTx = vi.hoisted(() => ({
  supply: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  supplyPurchase: {
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  accountsPayable: {
    create: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../database/prisma/client', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
    supplyPurchase: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('../accounts-payable/accounts-payable.service', () => ({
  AccountsPayableService: vi.fn(function AccountsPayableService() {
    return { createFromSupplyPurchase: vi.fn().mockResolvedValue(undefined) }
  }),
}))

import { SupplyPurchasesService } from './supply-purchases.service'

function makeSupply(overrides: Record<string, unknown> = {}) {
  return {
    id: 'supply-1',
    clinicId: 'clinic-1',
    name: 'Ácido hialurônico',
    unit: 'ml',
    stock: 200,
    minStock: 10,
    active: true,
    deletedAt: null,
    ...overrides,
  }
}

function makePurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'purchase-1',
    clinicId: 'clinic-1',
    supplyId: 'supply-1',
    supplierName: 'Fornecedor Teste',
    purchaseUnit: 'caixa',
    purchaseQty: 1,
    conversionFactor: 500,
    stockIncrement: 500,
    unitCost: 25000,
    totalCost: 25000,
    notes: null,
    purchasedAt: new Date('2026-03-20T12:00:00.000Z'),
    createdAt: new Date('2026-03-20T12:00:00.000Z'),
    supply: makeSupply({ stock: 700 }),
    ...overrides,
  }
}

describe('SupplyPurchasesService.create()', () => {
  let service: SupplyPurchasesService

  beforeEach(() => {
    vi.resetAllMocks()
    service = new SupplyPurchasesService()
  })

  it('cria a compra em transação e incrementa o estoque calculado', async () => {
    const { prisma } = await import('../../database/prisma/client')
    mockTx.supply.findFirst.mockResolvedValue(makeSupply())
    mockTx.supply.update.mockResolvedValue(makeSupply({ stock: 700 }))
    mockTx.supplyPurchase.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      makePurchase({
        ...data,
        supply: makeSupply({ stock: 700 }),
      }),
    )

    const result = await service.create('clinic-1', {
      supplyId: 'supply-1',
      supplierName: 'Fornecedor Teste',
      purchaseUnit: 'caixa',
      purchaseQty: 1,
      conversionFactor: 500,
      unitCost: 25000,
      notes: 'Compra mensal',
      purchasedAt: '2026-03-20T12:00:00.000Z',
    })

    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(mockTx.supply.update).toHaveBeenCalledWith({
      where: { id: 'supply-1' },
      data: { stock: { increment: 500 } },
    })
    expect(mockTx.supplyPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockIncrement: 500,
          totalCost: 25000,
        }),
      }),
    )
    expect(result.stockIncrement).toBe(500)
  })

  it('aplica floor no estoque incrementado e round no custo total', async () => {
    mockTx.supply.findFirst.mockResolvedValue(makeSupply())
    mockTx.supply.update.mockResolvedValue(makeSupply({ stock: 202 }))
    mockTx.supplyPurchase.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      makePurchase({
        ...data,
        stockIncrement: data.stockIncrement,
        totalCost: data.totalCost,
        supply: makeSupply({ stock: 202 }),
      }),
    )

    const result = await service.create('clinic-1', {
      supplyId: 'supply-1',
      supplierName: null,
      purchaseUnit: 'frasco',
      purchaseQty: 1.5,
      conversionFactor: 1.9,
      unitCost: 1999,
      notes: null,
      purchasedAt: '2026-03-20T12:00:00.000Z',
    })

    expect(mockTx.supply.update).toHaveBeenCalledWith({
      where: { id: 'supply-1' },
      data: { stock: { increment: 2 } },
    })
    expect(result.stockIncrement).toBe(2)
    expect(result.totalCost).toBe(2999)
  })
})

describe('SupplyPurchasesService.delete()', () => {
  let service: SupplyPurchasesService

  beforeEach(() => {
    vi.resetAllMocks()
    service = new SupplyPurchasesService()
  })

  it('estorna o estoque e remove a compra quando há saldo suficiente', async () => {
    mockTx.supplyPurchase.findFirst.mockResolvedValue(makePurchase())
    mockTx.supply.updateMany.mockResolvedValue({ count: 1 })
    mockTx.supplyPurchase.delete.mockResolvedValue(makePurchase())

    const result = await service.delete('clinic-1', 'purchase-1')

    expect(mockTx.supply.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'supply-1',
        clinicId: 'clinic-1',
        stock: { gte: 500 },
      },
      data: { stock: { decrement: 500 } },
    })
    expect(mockTx.supplyPurchase.delete).toHaveBeenCalledWith({ where: { id: 'purchase-1' } })
    expect(result).toEqual({ message: 'Compra cancelada com sucesso' })
  })

  it('bloqueia o cancelamento quando o estoque não suporta o estorno', async () => {
    mockTx.supplyPurchase.findFirst.mockResolvedValue(makePurchase())
    mockTx.supply.updateMany.mockResolvedValue({ count: 0 })
    mockTx.supply.findFirst.mockResolvedValue({ stock: 120, unit: 'ml' })

    await expect(service.delete('clinic-1', 'purchase-1')).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK_FOR_REVERSAL',
      statusCode: 409,
    })
    expect(mockTx.supplyPurchase.delete).not.toHaveBeenCalled()
  })

  it('permite cancelar compra de insumo soft-deletado quando ainda existe saldo', async () => {
    mockTx.supplyPurchase.findFirst.mockResolvedValue(makePurchase({ supply: makeSupply({ deletedAt: new Date() }) }))
    mockTx.supply.updateMany.mockResolvedValue({ count: 1 })
    mockTx.supplyPurchase.delete.mockResolvedValue(makePurchase())

    await service.delete('clinic-1', 'purchase-1')

    expect(mockTx.supply.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'supply-1',
        clinicId: 'clinic-1',
        stock: { gte: 500 },
      },
      data: { stock: { decrement: 500 } },
    })
  })

  it('retorna mensagem em pt-br quando a compra não existe', async () => {
    mockTx.supplyPurchase.findFirst.mockResolvedValue(null)

    await expect(service.delete('clinic-1', 'purchase-404')).rejects.toMatchObject({
      code: 'SUPPLY_PURCHASE_NOT_FOUND',
      statusCode: 404,
      message: 'Compra de insumo não encontrada.',
    })
  })
})