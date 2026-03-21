import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  markOverdue: vi.fn(),
}))

const mockPrisma = vi.hoisted(() => ({
  billing: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  paymentMethodConfig: {
    findUnique: vi.fn(),
  },
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

    expect(mockPrisma.billing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: 'clinic-1',
        customerId: 'customer-1',
        appointmentId: 'appointment-1',
        amount: 35000,
        paymentMethods: ['pix', 'boleto', 'card'],
      }),
    })
    expect(result).toMatchObject({ paymentMethods: ['pix', 'boleto', 'card'] })
  })

  it('deve incluir parcelamento e duplicata quando configurados na clínica', async () => {
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

    expect(mockPrisma.billing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentMethods: ['pix', 'card', 'installments', 'duplicata'],
      }),
    })
    expect(result).toMatchObject({ paymentMethods: ['pix', 'card', 'installments', 'duplicata'] })
  })

  it('deve manter a operação idempotente quando a cobrança já existir', async () => {
    mockPrisma.billing.findUnique.mockResolvedValue({ id: 'billing-existing' })

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
