import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist mocks ─────────────────────────────────────────────────────────────

const mockRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findCustomerPackages: vi.fn(),
  findSoldPackages: vi.fn(),
  findBillingByIdempotencyKey: vi.fn(),
  createCustomerPackage: vi.fn(),
  createSessions: vi.fn(),
  updateCustomerPackageBilling: vi.fn(),
  findSessionById: vi.fn(),
  findCustomerPackageById: vi.fn(),
  redeemSession: vi.fn(),
  linkSession: vi.fn(),
  unlinkSession: vi.fn(),
  findLinkedSession: vi.fn(),
  countCustomerPromotionUsage: vi.fn(),
}))

const mockWallet = vi.hoisted(() => ({
  createInternal: vi.fn(),
}))

const mockLedger = vi.hoisted(() => ({
  createDebitEntry: vi.fn(),
}))

const mockTx = vi.hoisted(() => ({
  customerPackage: { update: vi.fn() },
  billing: { create: vi.fn() },
  ledgerEntry: { create: vi.fn() },
}))

vi.mock('../../database/prisma/client', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    customer: { findFirst: vi.fn() },
    billing: { findFirst: vi.fn() },
  },
}))

vi.mock('./packages.repository', () => ({
  PackagesRepository: vi.fn(function () { return mockRepo }),
}))

vi.mock('../wallet/wallet.service', () => ({
  WalletService: vi.fn(function () { return mockWallet }),
}))

vi.mock('../ledger/ledger.service', () => ({
  LedgerService: vi.fn(function () { return mockLedger }),
}))

import { PackagesService } from './packages.service'
import { prisma } from '../../database/prisma/client'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CLINIC_ID = 'clinic-1'
const PKG_ID = 'pkg-1'
const CUSTOMER_ID = 'cust-1'
const SESSION_ID = 'sess-1'

function makePackage(overrides: Record<string, unknown> = {}) {
  return {
    id: PKG_ID,
    clinicId: CLINIC_ID,
    name: 'Pacote Facial',
    price: 30000,
    active: true,
    validityDays: 180,
    items: [{ serviceId: 'svc-1', quantity: 3 }],
    ...overrides,
  }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    clinicId: CLINIC_ID,
    serviceId: 'svc-1',
    status: 'ABERTO',
    usedAt: null,
    appointmentId: null,
    customerPackageId: 'cp-1',
    customerPackage: { id: 'cp-1', expiresAt: null },
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PackagesService', () => {
  let svc: PackagesService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new PackagesService()
  })

  // ──── purchasePackage ─────────────────────────────────────────────────────

  describe('purchasePackage()', () => {
    it('lança PACKAGE_INACTIVE se pacote estiver inativo', async () => {
      mockRepo.findById.mockResolvedValue(makePackage({ active: false }))

      await expect(
        svc.purchasePackage(CLINIC_ID, PKG_ID, {
          customerId: CUSTOMER_ID,
          paymentMethods: [{ method: 'cash', amount: 30000 }],
        }, 'idem-key'),
      ).rejects.toMatchObject({ code: 'PACKAGE_INACTIVE' })
    })

    it('lança NOT_FOUND se pacote não existir', async () => {
      mockRepo.findById.mockResolvedValue(null)

      await expect(
        svc.purchasePackage(CLINIC_ID, PKG_ID, {
          customerId: CUSTOMER_ID,
          paymentMethods: [{ method: 'pix', amount: 30000 }],
        }, 'idem-key'),
      ).rejects.toMatchObject({ message: expect.stringContaining('not found') })
    })

    it('lança PAYMENT_AMOUNT_INSUFFICIENT se pagamento for insuficiente', async () => {
      mockRepo.findById.mockResolvedValue(makePackage())
      vi.mocked(prisma.billing.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.customer.findFirst).mockResolvedValue({ id: CUSTOMER_ID, clinicId: CLINIC_ID } as never)

      await expect(
        svc.purchasePackage(CLINIC_ID, PKG_ID, {
          customerId: CUSTOMER_ID,
          paymentMethods: [{ method: 'cash', amount: 10000 }], // só 100 dos 300 necessários
        }, 'idem-key'),
      ).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_INSUFFICIENT' })
    })

    it('retorna cobrança existente se idempotencyKey já foi usada', async () => {
      const existingBilling = { id: 'billing-already', customerPackage: { id: 'cp-1', sessions: [] } }
      vi.mocked(prisma.billing.findFirst).mockResolvedValue(existingBilling as never)

      const result = await svc.purchasePackage(CLINIC_ID, PKG_ID, {
        customerId: CUSTOMER_ID,
        paymentMethods: [{ method: 'pix', amount: 30000 }],
      }, 'idem-key')

      expect(result).toEqual({ customerPackageId: 'cp-1', billingId: 'billing-already', sessions: [], wasCreated: false })
      expect(mockRepo.createCustomerPackage).not.toHaveBeenCalled()
    })
  })

  // ──── redeemSession ───────────────────────────────────────────────────────

  describe('redeemSession()', () => {
    it('lança NOT_FOUND se sessão não pertencer à clínica', async () => {
      mockRepo.findSessionById.mockResolvedValue(null)

      await expect(
        svc.redeemSession(CLINIC_ID, SESSION_ID),
      ).rejects.toMatchObject({ message: expect.stringContaining('not found') })
    })

    it('lança SESSION_ALREADY_REDEEMED se status for FINALIZADO', async () => {
      mockRepo.findSessionById.mockResolvedValue(makeSession({ status: 'FINALIZADO' }))

      await expect(
        svc.redeemSession(CLINIC_ID, SESSION_ID),
      ).rejects.toMatchObject({ code: 'SESSION_ALREADY_REDEEMED' })
    })

    it('lança PACKAGE_EXPIRED se status for EXPIRADO', async () => {
      mockRepo.findSessionById.mockResolvedValue(makeSession({ status: 'EXPIRADO' }))

      await expect(
        svc.redeemSession(CLINIC_ID, SESSION_ID),
      ).rejects.toMatchObject({ code: 'PACKAGE_EXPIRED' })
    })

    it('resgata sessão com sucesso se status for ABERTO', async () => {
      mockRepo.findSessionById.mockResolvedValue(makeSession({ status: 'ABERTO' }))
      mockRepo.findCustomerPackageById.mockResolvedValue({ id: 'cp-1', expiresAt: null })
      mockRepo.redeemSession.mockResolvedValue({ id: SESSION_ID, status: 'FINALIZADO' })

      const result = await svc.redeemSession(CLINIC_ID, SESSION_ID)

      expect(mockRepo.redeemSession).toHaveBeenCalledWith(SESSION_ID, undefined)
      expect(result).toEqual({ id: SESSION_ID, status: 'FINALIZADO' })
    })
  })
})
