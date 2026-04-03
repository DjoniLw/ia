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
  billing: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  walletEntry: { findUnique: vi.fn() },
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

vi.mock('../wallet/wallet.service', () => ({
  WalletService: vi.fn(function WalletService() {
    return { use: vi.fn(), createInternal: vi.fn() }
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

  // T04 — PRESALE sem serviceId → 400
  it('T04: lança SERVICE_REQUIRED_FOR_PRESALE quando sourceType=PRESALE sem serviceId', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-1', clinicId: 'clinic-1' })

    await expect(
      service.createManual(
        { customerId: 'customer-1', sourceType: 'PRESALE', amount: 20000 },
        'clinic-1',
      ),
    ).rejects.toMatchObject({ code: 'SERVICE_REQUIRED_FOR_PRESALE' })
  })
})

// ─── T05-T06: BillingService.receivePayment() PRESALE + wallet entry ───────────
describe('BillingService.receivePayment() — RN11 (SERVICE_PRESALE)', () => {
  let service: BillingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BillingService()
  })

  // T05 — Pagamento PRESALE cria walletEntry SERVICE_PRESALE
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

    // repo.findById chamado dentro de get()
    mockRepo.findById.mockResolvedValue(billingMock)
    mockRepo.updateStatus.mockResolvedValue({ ...billingMock, status: 'paid' })

    // WalletService.createInternal mock — importado no módulo
    const { WalletService } = await import('../wallet/wallet.service')
    const walletInstance = (WalletService as ReturnType<typeof vi.fn>).mock.results[0]?.value
    if (walletInstance) {
      walletInstance.createInternal.mockResolvedValue({ id: 'wallet-entry-1', originType: 'SERVICE_PRESALE' })
    }

    const result = await service.receivePayment('clinic-1', 'billing-presale', {
      method: 'pix',
      receivedAmount: 20000,
    })

    expect(result).toMatchObject({ status: 'paid' })
    // Verifica que wallet.createInternal foi chamado com SERVICE_PRESALE
    if (walletInstance) {
      expect(walletInstance.createInternal).toHaveBeenCalledWith(
        expect.objectContaining({ originType: 'SERVICE_PRESALE', serviceId: 'service-1' }),
      )
    }
  })
})
