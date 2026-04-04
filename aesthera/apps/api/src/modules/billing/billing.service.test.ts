import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  markOverdue: vi.fn(),
}))

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTxBilling)),
  billing: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  paymentMethodConfig: {
    findUnique: vi.fn(),
  },
  customer: {
    findFirst: vi.fn(),
  },
  service: {
    findUnique: vi.fn(),
  },
  walletEntry: {
    findUnique: vi.fn(),
  },
  clinic: {
    findUnique: vi.fn(),
  },
}))

const mockTxBilling = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([]),
  billing: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  walletEntry: { findUnique: vi.fn(), findFirst: vi.fn() },
  service: { findUnique: vi.fn() },
  paymentMethodConfig: { findUnique: vi.fn() },
  clinic: { findUnique: vi.fn() },
}))

vi.mock('../../database/prisma/client', () => ({
  prisma: mockPrisma,
}))

vi.mock('./billing.repository', () => ({
  BillingRepository: vi.fn(function BillingRepository() {
    return mockRepo
  }),
}))

vi.mock('../ledger/ledger.service', () => ({
  LedgerService: vi.fn(function LedgerService() {
    return { createCreditEntry: vi.fn() }
  }),
}))

const mockWalletInstance = vi.hoisted(() => ({
  use: vi.fn(),
  createInternal: vi.fn(),
}))

vi.mock('../wallet/wallet.service', () => ({
  WalletService: vi.fn(function WalletService() {
    return mockWalletInstance
  }),
}))

vi.mock('../promotions/promotions.service', () => ({
  PromotionsService: vi.fn(function PromotionsService() {
    return { apply: vi.fn() }
  }),
}))

import { BillingService } from './billing.service'

describe('BillingService.createForAppointment()', () => {
  let service: BillingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BillingService()
  })

  it('deve usar os defaults quando a clínica ainda não configurou as formas de pagamento', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-1', clinicId: 'clinic-1' })
    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockPrisma.paymentMethodConfig.findUnique.mockResolvedValue(null)
    mockPrisma.billing.create.mockResolvedValue({
      id: 'billing-1',
      paymentMethods: ['pix', 'boleto', 'card'],
    })

    const result = await service.createForAppointment({
      id: 'appointment-1',
      clinicId: 'clinic-1',
      customerId: 'customer-1',
      price: 35000,
      scheduledAt: new Date('2026-03-20T10:00:00.000Z'),
    })

    expect(mockPrisma.billing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicId: 'clinic-1',
          customerId: 'customer-1',
          appointmentId: 'appointment-1',
          amount: 35000,
          paymentMethods: ['pix', 'boleto', 'card'],
        }),
      }),
    )
    expect(result).toMatchObject({ paymentMethods: ['pix', 'boleto', 'card'] })
  })

  it('deve incluir parcelamento e duplicata quando configurados na clínica', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-2', clinicId: 'clinic-1' })
    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockPrisma.paymentMethodConfig.findUnique.mockResolvedValue({
      clinicId: 'clinic-1',
      pixEnabled: true,
      boletoEnabled: false,
      cardEnabled: true,
      installmentsEnabled: true,
      installmentsMaxMonths: 12,
      installmentsMinAmount: 20000,
      duplicataEnabled: true,
      duplicataDaysInterval: 30,
      duplicataMaxInstallments: 6,
    })
    mockPrisma.billing.create.mockResolvedValue({
      id: 'billing-2',
      paymentMethods: ['pix', 'card', 'installments', 'duplicata'],
    })

    const result = await service.createForAppointment({
      id: 'appointment-2',
      clinicId: 'clinic-1',
      customerId: 'customer-2',
      price: 42000,
      scheduledAt: new Date('2026-03-20T14:00:00.000Z'),
    })

    expect(mockPrisma.billing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethods: ['pix', 'card', 'installments', 'duplicata'],
        }),
      }),
    )
    expect(result).toMatchObject({ paymentMethods: ['pix', 'card', 'installments', 'duplicata'] })
  })

  it('deve manter a operação idempotente quando a cobrança já existir', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-3', clinicId: 'clinic-1' })
    mockPrisma.billing.findUnique.mockResolvedValue({ id: 'billing-existing', status: 'pending' })
    mockPrisma.billing.findUniqueOrThrow.mockResolvedValue({ id: 'billing-existing', status: 'pending', customer: { id: 'customer-3', name: 'Test' }, service: null })

    const result = await service.createForAppointment({
      id: 'appointment-3',
      clinicId: 'clinic-1',
      customerId: 'customer-3',
      price: 50000,
      scheduledAt: new Date('2026-03-21T10:00:00.000Z'),
    })

    expect(mockPrisma.billing.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ id: 'billing-existing' })
  })
})

// ─── T01-T06: BillingService.createManual() ────────────────────────────────────
describe('BillingService.createManual()', () => {
  let service: BillingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BillingService()
  })

  // T01 — PRESALE cria billing com sourceType PRESALE e serviceId
  it('T01: cria billing PRESALE com serviceId quando sourceType=PRESALE', async () => {
    mockPrisma.service.findUnique.mockResolvedValue({ id: 'service-1', clinicId: 'clinic-1' })
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-1', clinicId: 'clinic-1' })
    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockPrisma.paymentMethodConfig.findUnique.mockResolvedValue(null)
    mockPrisma.billing.create.mockResolvedValue({ id: 'billing-presale', sourceType: 'PRESALE', serviceId: 'service-1' })

    const result = await service.createManual(
      { customerId: 'customer-1', sourceType: 'PRESALE', amount: 20000, serviceId: 'service-1' },
      'clinic-1',
    )

    expect(mockPrisma.billing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceType: 'PRESALE', serviceId: 'service-1' }),
      }),
    )
    expect(result).toMatchObject({ sourceType: 'PRESALE' })
  })

  // T02 — Idempotência APPOINTMENT: retorna existing quando já existe
  it('T02: retorna billing existente quando sourceType=APPOINTMENT e billing já existe (pending)', async () => {
    mockPrisma.service.findUnique.mockResolvedValue(null)
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-1', clinicId: 'clinic-1' })
    mockPrisma.billing.findUnique.mockResolvedValue({ id: 'billing-existing', status: 'pending', appointmentId: 'appt-1' })
    mockPrisma.billing.findUniqueOrThrow.mockResolvedValue({ id: 'billing-existing', status: 'pending', appointmentId: 'appt-1', customer: { id: 'customer-1', name: 'Test' }, service: null })

    const result = await service.createManual(
      { customerId: 'customer-1', sourceType: 'APPOINTMENT', amount: 15000, appointmentId: 'appt-1' },
      'clinic-1',
    )

    expect(mockPrisma.billing.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ id: 'billing-existing' })
  })

  // T03 — Customer não pertence à clínica → 403
  it('T03: lança 403 quando customerId não pertence à clínica', async () => {
    mockPrisma.service.findUnique.mockResolvedValue(null)
    mockPrisma.customer.findFirst.mockResolvedValue(null)

    await expect(
      service.createManual(
        { customerId: 'customer-outro', sourceType: 'MANUAL', amount: 10000 },
        'clinic-1',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(mockPrisma.billing.create).not.toHaveBeenCalled()
  })

  // T07 — APPOINTMENT com billing já pago → 409 BILLING_ALREADY_PAID
  it('T07: lança BILLING_ALREADY_PAID quando sourceType=APPOINTMENT e billing já está pago', async () => {
    mockPrisma.service.findUnique.mockResolvedValue(null)
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-1', clinicId: 'clinic-1' })
    mockPrisma.billing.findUnique.mockResolvedValue({ id: 'billing-existente', status: 'paid', appointmentId: 'appt-7' })

    await expect(
      service.createManual(
        { customerId: 'customer-1', sourceType: 'APPOINTMENT', amount: 15000, appointmentId: 'appt-7' },
        'clinic-1',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'BILLING_ALREADY_PAID' })

    expect(mockPrisma.billing.create).not.toHaveBeenCalled()
  })

  // T09 — serviceId de outra clínica → 403 (SEC02)
  it('T09: lança 403 quando serviceId pertence a outra clínica', async () => {
    mockPrisma.service.findUnique.mockResolvedValue({ id: 'service-externo', clinicId: 'clinic-2' })

    await expect(
      service.createManual(
        { customerId: 'customer-1', sourceType: 'PRESALE', amount: 20000, serviceId: 'service-externo' },
        'clinic-1',
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(mockPrisma.billing.create).not.toHaveBeenCalled()
  })
})

// ─── T05-T06: BillingService.receivePayment() ──────────────────────────────────
describe('BillingService.receivePayment()', () => {
  let service: BillingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BillingService()
  })

  // T05 — Pagamento PRESALE cria walletEntry SERVICE_PRESALE (assertiva determinística via vi.hoisted)
  it('T05: cria SERVICE_PRESALE wallet entry quando sourceType=PRESALE e pagamento recebido', async () => {
    const billingMock = {
      id: 'billing-presale',
      clinicId: 'clinic-1',
      customerId: 'customer-1',
      sourceType: 'PRESALE',
      serviceId: 'service-1',
      amount: 20000,
      status: 'pending',
      appointmentId: null,
      appointment: null,
      service: { id: 'service-1', name: 'Limpeza de Pele' },
    }

    mockRepo.findById.mockResolvedValue(billingMock)
    // Inside $transaction (B1): locked billing check
    mockTxBilling.billing.findFirst.mockResolvedValue(billingMock)
    // wallet.createInternal — referência direta via mockWalletInstance (sem dynamic import + if)
    mockWalletInstance.createInternal.mockResolvedValue({ id: 'wallet-entry-1', originType: 'SERVICE_PRESALE' })

    const result = await service.receivePayment('clinic-1', 'billing-presale', {
      method: 'pix',
      receivedAmount: 20000,
    })

    expect(result).toMatchObject({ status: 'paid' })
    // Assertiva determinística — nunca silenciosamente pulada
    expect(mockWalletInstance.createInternal).toHaveBeenCalledWith(
      expect.objectContaining({ originType: 'SERVICE_PRESALE', serviceId: 'service-1' }),
    )
  })

  // T06a — chargeVoucherDifference=true + voucher < preço → billing complementar com appointmentId=null (RN14)
  it('T06a: cria billing complementar com appointmentId=null quando chargeVoucherDifference=true e voucher < preço', async () => {
    const billingMock = {
      id: 'billing-1',
      clinicId: 'clinic-1',
      customerId: 'customer-1',
      sourceType: 'APPOINTMENT',
      serviceId: 'service-1',
      amount: 10000,
      status: 'pending',
      appointmentId: 'appt-1',
      appointment: null,
      service: { id: 'service-1', name: 'Limpeza' },
    }
    mockRepo.findById.mockResolvedValue(billingMock)
    mockTxBilling.billing.findFirst.mockResolvedValue(billingMock)
    mockWalletInstance.use.mockResolvedValue(undefined)
    mockTxBilling.clinic.findUnique.mockResolvedValue({ id: 'clinic-1', chargeVoucherDifference: true })
    mockTxBilling.service.findUnique.mockResolvedValue({ id: 'service-1', price: 10000 })
    mockTxBilling.walletEntry.findFirst.mockResolvedValue({ id: 'voucher-1', originalValue: 8000 })
    mockTxBilling.paymentMethodConfig.findUnique.mockResolvedValue(null)
    mockTxBilling.billing.create.mockResolvedValue({ id: 'billing-compl', amount: 2000, appointmentId: null })

    const result = await service.receivePayment('clinic-1', 'billing-1', {
      method: 'voucher',
      voucherId: 'voucher-1',
      receivedAmount: 10000,
    })

    // RN14: appointmentId=null obrigatório no billing complementar
    expect(mockTxBilling.billing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ appointmentId: null, amount: 2000 }),
      }),
    )
    expect(result.billingComplementar).toMatchObject({ amount: 2000, appointmentId: null })
  })

  // T06b — chargeVoucherDifference=false → billing complementar NÃO criado
  it('T06b: NÃO cria billing complementar quando chargeVoucherDifference=false', async () => {
    const billingMock = {
      id: 'billing-1',
      clinicId: 'clinic-1',
      customerId: 'customer-1',
      sourceType: 'APPOINTMENT',
      serviceId: 'service-1',
      amount: 10000,
      status: 'pending',
      appointmentId: 'appt-1',
      appointment: null,
      service: null,
    }
    mockRepo.findById.mockResolvedValue(billingMock)
    mockTxBilling.billing.findFirst.mockResolvedValue(billingMock)
    mockWalletInstance.use.mockResolvedValue(undefined)
    mockTxBilling.clinic.findUnique.mockResolvedValue({ id: 'clinic-1', chargeVoucherDifference: false })

    await service.receivePayment('clinic-1', 'billing-1', {
      method: 'voucher',
      voucherId: 'voucher-1',
      receivedAmount: 10000,
    })

    expect(mockTxBilling.billing.create).not.toHaveBeenCalled()
  })
})
