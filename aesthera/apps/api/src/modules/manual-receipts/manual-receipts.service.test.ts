import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockBillingRepo = vi.hoisted(() => ({
  findById: vi.fn(),
}))

const mockTx = vi.hoisted(() => ({
  manualReceipt: {
    create: vi.fn(),
  },
  billing: {
    update: vi.fn(),
  },
  promotion: {
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  promotionUsage: {
    create: vi.fn(),
  },
  walletEntry: {
    findUnique: vi.fn(),
  },
}))

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
  manualReceipt: {
    findUnique: vi.fn(),
  },
  appointmentServiceItem: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}))

const mockWalletInstance = vi.hoisted(() => ({
  use: vi.fn(),
  createInternal: vi.fn(),
}))

const mockLedgerInstance = vi.hoisted(() => ({
  createCreditEntry: vi.fn(),
}))

const mockPromotionsInstance = vi.hoisted(() => ({
  validate: vi.fn(),
}))

vi.mock('../../database/prisma/client', () => ({
  prisma: mockPrisma,
}))

vi.mock('../billing/billing.repository', () => ({
  BillingRepository: vi.fn(function BillingRepository() {
    return mockBillingRepo
  }),
}))

vi.mock('../ledger/ledger.service', () => ({
  LedgerService: vi.fn(function LedgerService() {
    return mockLedgerInstance
  }),
}))

vi.mock('../wallet/wallet.service', () => ({
  WalletService: vi.fn(function WalletService() {
    return mockWalletInstance
  }),
}))

vi.mock('../promotions/promotions.service', () => ({
  PromotionsService: vi.fn(function PromotionsService() {
    return mockPromotionsInstance
  }),
}))

import { ManualReceiptsService } from './manual-receipts.service'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseBilling = {
  id: 'billing-1',
  clinicId: 'clinic-1',
  customerId: 'customer-1',
  sourceType: 'PRESALE',
  serviceId: 'service-1',
  status: 'pending',
  amount: 10000,
  appointmentId: null,
}

const baseDto = {
  lines: [{ paymentMethod: 'cash' as const, amount: 10000 }],
}

const receiptMock = { id: 'receipt-1', lines: [] }

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ManualReceiptsService.receive() — RN11 (PRESALE → WalletEntry SERVICE_PRESALE)', () => {
  let service: ManualReceiptsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ManualReceiptsService()

    // Defaults válidos para todos os testes
    mockPrisma.manualReceipt.findUnique.mockResolvedValue(null)
    mockTx.manualReceipt.create.mockResolvedValue(receiptMock)
    mockTx.billing.update.mockResolvedValue({})
    mockLedgerInstance.createCreditEntry.mockResolvedValue({})
    mockWalletInstance.createInternal.mockResolvedValue({ code: 'VOUCHER-001', balance: 10000 })
  })

  // ────────────────────────────────────────────────────────────────────────────
  it('T-MR-01: pagar PRESALE com serviceId → cria WalletEntry SERVICE_PRESALE com saldo = valor efetivo', async () => {
    mockBillingRepo.findById.mockResolvedValue(baseBilling)

    const result = await service.receive('clinic-1', 'billing-1', baseDto)

    expect(mockWalletInstance.createInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-1',
        customerId: 'customer-1',
        type: 'VOUCHER',
        value: 10000,
        originType: 'SERVICE_PRESALE',
        originReference: 'billing-1',
        serviceId: 'service-1',
      }),
      mockTx,
    )
    expect(result.serviceVoucherEntry).toMatchObject({ code: 'VOUCHER-001', balance: 10000 })
  })

  // ────────────────────────────────────────────────────────────────────────────
  it('T-MR-02: pagar PRESALE com desconto → WalletEntry com value = valor pós-desconto (txEffectiveAmount)', async () => {
    mockBillingRepo.findById.mockResolvedValue(baseBilling)

    // Promoção: 2000 de desconto → effectiveAmount = 8000
    mockPromotionsInstance.validate.mockResolvedValue({
      promotion: { id: 'promo-1', maxUses: null },
      discountAmount: 2000,
    })
    mockTx.promotion.update.mockResolvedValue({})
    mockTx.promotionUsage.create.mockResolvedValue({})

    // Cliente paga 8000 (valor com desconto)
    const dto = {
      lines: [{ paymentMethod: 'cash' as const, amount: 8000 }],
      promotionCode: 'DESC20',
    }

    await service.receive('clinic-1', 'billing-1', dto)

    expect(mockWalletInstance.createInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        originType: 'SERVICE_PRESALE',
        value: 8000, // txEffectiveAmount = 10000 - 2000
      }),
      mockTx,
    )
  })

  // ────────────────────────────────────────────────────────────────────────────
  it('T-MR-03: pagar cobrança APPOINTMENT → NÃO cria WalletEntry SERVICE_PRESALE', async () => {
    mockBillingRepo.findById.mockResolvedValue({
      ...baseBilling,
      sourceType: 'APPOINTMENT',
    })

    await service.receive('clinic-1', 'billing-1', baseDto)

    const presaleCalls = (mockWalletInstance.createInternal.mock.calls as Array<[{ originType?: string }, unknown]>)
      .filter(([data]) => data.originType === 'SERVICE_PRESALE')
    expect(presaleCalls).toHaveLength(0)
  })

  // ────────────────────────────────────────────────────────────────────────────
  it('T-MR-04: PRESALE sem serviceId → NÃO cria WalletEntry SERVICE_PRESALE (condição de guarda)', async () => {
    mockBillingRepo.findById.mockResolvedValue({
      ...baseBilling,
      serviceId: null,
    })

    await service.receive('clinic-1', 'billing-1', baseDto)

    const presaleCalls = (mockWalletInstance.createInternal.mock.calls as Array<[{ originType?: string }, unknown]>)
      .filter(([data]) => data.originType === 'SERVICE_PRESALE')
    expect(presaleCalls).toHaveLength(0)
  })

  // ────────────────────────────────────────────────────────────────────────────
  it('T-MR-05: wallet.createInternal lança erro → erro propaga (transação reverte em produção)', async () => {
    mockBillingRepo.findById.mockResolvedValue(baseBilling)
    mockWalletInstance.createInternal.mockRejectedValue(new Error('DB connection error'))

    await expect(service.receive('clinic-1', 'billing-1', baseDto)).rejects.toThrow('DB connection error')
  })
})

// ── T-FIN01–T-FIN03: RN-FIN01 — voucher SERVICE_PRESALE não gera entrada no Ledger ──
describe('ManualReceiptsService.receive() — RN-FIN01 (SERVICE_PRESALE skip ledger)', () => {
  let service: ManualReceiptsService

  const appointmentBilling = {
    id: 'billing-appt',
    clinicId: 'clinic-1',
    customerId: 'customer-1',
    sourceType: 'APPOINTMENT',
    serviceId: 'service-1',
    status: 'pending',
    amount: 18000,
    appointmentId: 'appt-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ManualReceiptsService()
    mockPrisma.manualReceipt.findUnique.mockResolvedValue(null)
    mockTx.manualReceipt.create.mockResolvedValue({ id: 'receipt-fin', lines: [] })
    mockTx.billing.update.mockResolvedValue({})
    mockLedgerInstance.createCreditEntry.mockResolvedValue({})
    mockWalletInstance.use.mockResolvedValue({})
    mockWalletInstance.createInternal.mockResolvedValue({ code: 'VCHR-OUT', balance: 0 })
  })

  // T-FIN01: voucher SERVICE_PRESALE → ledger.createCreditEntry NÃO chamado
  it('T-FIN01: pagamento com voucher SERVICE_PRESALE não gera LedgerEntry (dinheiro já contabilizado)', async () => {
    mockBillingRepo.findById.mockResolvedValue(appointmentBilling)
    mockTx.walletEntry.findUnique.mockResolvedValue({ id: 'we-1', originType: 'SERVICE_PRESALE' })
    mockWalletInstance.use.mockResolvedValue({})

    const dto = {
      lines: [{ paymentMethod: 'wallet_voucher' as const, amount: 18000, walletEntryId: 'we-1' }],
    }

    await service.receive('clinic-1', 'billing-appt', dto)

    expect(mockLedgerInstance.createCreditEntry).not.toHaveBeenCalled()
  })

  // T-FIN02: voucher OVERPAYMENT → ledger.createCreditEntry chamado normalmente
  it('T-FIN02: pagamento com voucher OVERPAYMENT gera LedgerEntry normalmente', async () => {
    mockBillingRepo.findById.mockResolvedValue(appointmentBilling)
    mockTx.walletEntry.findUnique.mockResolvedValue({ id: 'we-2', originType: 'OVERPAYMENT' })
    mockWalletInstance.use.mockResolvedValue({})

    const dto = {
      lines: [{ paymentMethod: 'wallet_voucher' as const, amount: 18000, walletEntryId: 'we-2' }],
    }

    await service.receive('clinic-1', 'billing-appt', dto)

    expect(mockLedgerInstance.createCreditEntry).toHaveBeenCalledOnce()
  })

  // T-FIN03: pagamento misto (dinheiro + voucher SERVICE_PRESALE) → LedgerEntry apenas para linha de dinheiro
  it('T-FIN03: pagamento misto — LedgerEntry apenas para linha de dinheiro, não para SERVICE_PRESALE', async () => {
    const billing = { ...appointmentBilling, amount: 18000 }
    mockBillingRepo.findById.mockResolvedValue(billing)
    // linha 1: dinheiro (9000), linha 2: voucher SERVICE_PRESALE (9000)
    mockTx.walletEntry.findUnique.mockResolvedValue({ id: 'we-sp', originType: 'SERVICE_PRESALE' })
    mockWalletInstance.use.mockResolvedValue({})

    const dto = {
      lines: [
        { paymentMethod: 'cash' as const, amount: 9000 },
        { paymentMethod: 'wallet_voucher' as const, amount: 9000, walletEntryId: 'we-sp' },
      ],
    }

    await service.receive('clinic-1', 'billing-appt', dto)

    // Somente a linha de dinheiro deve gerar entrada no ledger
    expect(mockLedgerInstance.createCreditEntry).toHaveBeenCalledOnce()
    expect(mockLedgerInstance.createCreditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 9000 }),
      mockTx,
    )
  })
})
