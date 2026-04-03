import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist shared mocks so they are available before vi.mock hoisting ───────
const mockLogger = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }))

const mockTx = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([]),
  walletEntry: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  walletTransaction: { create: vi.fn() },
  billing: { findFirst: vi.fn() },
}))

const mockRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByIdForUpdate: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  updateBalance: vi.fn(),
  createTransaction: vi.fn(),
  sumActiveBalance: vi.fn(),
}))

// ─── Mock the Prisma client ─────────────────────────────────────────────────
vi.mock('../../database/prisma/client', () => ({
  prisma: {
    $transaction: vi.fn(async function (fn: (tx: unknown) => Promise<unknown>) {
      return fn(mockTx)
    }),
    customer: {
      findFirst: vi.fn(),
    },
  },
}))

// ─── Mock the WalletRepository ──────────────────────────────────────────────
vi.mock('./wallet.repository', () => ({
  WalletRepository: vi.fn(function () {
    return mockRepo
  }),
}))

// ─── Mock logger ────────────────────────────────────────────────────────────
vi.mock('../../shared/logger/logger', () => ({ logger: mockLogger }))

import { WalletService } from './wallet.service'

// ─── Helpers ────────────────────────────────────────────────────────────────
function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    clinicId: 'clinic-1',
    customerId: 'customer-1',
    type: 'VOUCHER',
    originalValue: 10000,
    balance: 10000,
    code: 'VCHR-ABCD1234',
    originType: 'GIFT',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { id: 'customer-1', name: 'Test', email: 'test@test.com', phone: null },
    transactions: [],
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('WalletService.use()', () => {
  let service: WalletService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WalletService()
  })

  it('wraps the operation in a database transaction', async () => {
    const { prisma } = await import('../../database/prisma/client')
    const entry = makeEntry({ balance: 10000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue({ ...entry, balance: 0, status: 'USED' })
    mockRepo.createTransaction.mockResolvedValue({})
    mockRepo.create.mockResolvedValue({ ...entry, id: 'entry-split' })

    await service.use('clinic-1', 'entry-1', 8000, 'billing-1')

    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })

  it('acquires a row-level lock via findByIdForUpdate', async () => {
    const entry = makeEntry({ balance: 10000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue({ ...entry, balance: 0, status: 'USED' })
    mockRepo.createTransaction.mockResolvedValue({})

    await service.use('clinic-1', 'entry-1', 8000, 'billing-1')

    expect(mockRepo.findByIdForUpdate).toHaveBeenCalledWith(mockTx, 'clinic-1', 'entry-1')
  })

  it('throws INSUFFICIENT_BALANCE when balance < amount (double spend prevention)', async () => {
    // Simulate: Payment A already consumed 80, leaving balance = 20
    const entry = makeEntry({ balance: 2000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)

    // Payment B requests 70 (7000 cents) but only 20 (2000 cents) remain
    await expect(service.use('clinic-1', 'entry-1', 7000, 'billing-2')).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })
  })

  it('never allows balance to go below zero', async () => {
    const entry = makeEntry({ balance: 5000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)

    // Requesting more than available
    await expect(service.use('clinic-1', 'entry-1', 6000, 'billing-1')).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })

    // updateBalance must NOT have been called — balance stays intact
    expect(mockRepo.updateBalance).not.toHaveBeenCalled()
  })

  it('throws WALLET_NOT_ACTIVE when entry is not active', async () => {
    const entry = makeEntry({ balance: 10000, status: 'USED' })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)

    await expect(service.use('clinic-1', 'entry-1', 5000, 'billing-1')).rejects.toMatchObject({
      code: 'WALLET_NOT_ACTIVE',
    })
  })

  it('marks the entry as USED and records a USE transaction on success', async () => {
    const entry = makeEntry({ balance: 10000 })
    const usedEntry = { ...entry, balance: 0, status: 'USED' }
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue(usedEntry)
    mockRepo.createTransaction.mockResolvedValue({})

    const result = await service.use('clinic-1', 'entry-1', 8000, 'billing-1')

    expect(mockRepo.updateBalance).toHaveBeenCalledWith('entry-1', 0, 'USED', mockTx)
    expect(mockRepo.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'USE', value: 8000, reference: 'billing-1' }),
      mockTx,
    )
    expect(result.remaining).toBe(0)
  })

  it('creates a split entry for leftover balance within the same transaction', async () => {
    const entry = makeEntry({ balance: 10000 })
    const usedEntry = { ...entry, balance: 0, status: 'USED' }
    const splitEntry = { ...entry, id: 'entry-split', balance: 2000, code: 'VCHR-SPLIT0001' }

    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue(usedEntry)
    mockRepo.createTransaction.mockResolvedValue({})
    mockRepo.create.mockResolvedValue(splitEntry)

    const result = await service.use('clinic-1', 'entry-1', 8000, 'billing-1')

    // Split entry created with leftover = 10000 - 8000 = 2000
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 2000, originType: 'VOUCHER_SPLIT' }),
      mockTx,
    )
    expect(result.newEntry).toBeDefined()
  })

  it('does NOT create a split entry when the full balance is used', async () => {
    const entry = makeEntry({ balance: 8000 })
    const usedEntry = { ...entry, balance: 0, status: 'USED' }

    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue(usedEntry)
    mockRepo.createTransaction.mockResolvedValue({})

    const result = await service.use('clinic-1', 'entry-1', 8000, 'billing-1')

    expect(mockRepo.create).not.toHaveBeenCalled()
    expect(result.newEntry).toBeNull()
  })
})

describe('WalletService.adjust()', () => {
  let service: WalletService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WalletService()
  })

  it('wraps the operation in a database transaction', async () => {
    const { prisma } = await import('../../database/prisma/client')
    const entry = makeEntry({ balance: 5000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue({ ...entry, balance: 7000 })
    mockRepo.createTransaction.mockResolvedValue({})

    await service.adjust('clinic-1', 'entry-1', { value: 2000, notes: 'top-up' })

    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })

  it('acquires a row-level lock via findByIdForUpdate', async () => {
    const entry = makeEntry({ balance: 5000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue({ ...entry, balance: 7000 })
    mockRepo.createTransaction.mockResolvedValue({})

    await service.adjust('clinic-1', 'entry-1', { value: 2000, notes: 'top-up' })

    expect(mockRepo.findByIdForUpdate).toHaveBeenCalledWith(mockTx, 'clinic-1', 'entry-1')
  })

  it('throws INSUFFICIENT_BALANCE when adjustment makes balance negative', async () => {
    const entry = makeEntry({ balance: 3000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)

    await expect(
      service.adjust('clinic-1', 'entry-1', { value: -5000, notes: 'deduct' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })

    expect(mockRepo.updateBalance).not.toHaveBeenCalled()
  })

  it('records an ADJUST transaction on success', async () => {
    const entry = makeEntry({ balance: 5000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue({ ...entry, balance: 7000 })
    mockRepo.createTransaction.mockResolvedValue({})

    await service.adjust('clinic-1', 'entry-1', { value: 2000, notes: 'top-up' })

    expect(mockRepo.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ADJUST', value: 2000 }),
      mockTx,
    )
  })

  it('marks the entry as USED when balance reaches zero', async () => {
    const entry = makeEntry({ balance: 3000 })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue({ ...entry, balance: 0, status: 'USED' })
    mockRepo.createTransaction.mockResolvedValue({})

    await service.adjust('clinic-1', 'entry-1', { value: -3000, notes: 'zero out' })

    expect(mockRepo.updateBalance).toHaveBeenCalledWith('entry-1', 0, 'USED', mockTx)
  })
})

describe('WalletService.create()', () => {
  let service: WalletService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WalletService()
  })

  it('wraps entry creation and transaction record in a single database transaction', async () => {
    const { prisma } = await import('../../database/prisma/client')
    const entry = makeEntry()
    mockRepo.create.mockResolvedValue(entry)
    mockRepo.createTransaction.mockResolvedValue({})

    await service.create('clinic-1', {
      customerId: 'customer-1',
      type: 'VOUCHER',
      value: 10000,
      originType: 'GIFT',
    })

    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ balance: 10000 }), mockTx)
    expect(mockRepo.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CREATE', value: 10000 }),
      mockTx,
    )
  })
})

describe('WalletService.list() \u2014 date range validation', () => {
  let service: WalletService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WalletService()
    mockRepo.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })
  })

  it('passes through when no date params are given', async () => {
    await expect(service.list('clinic-1', { page: 1, limit: 20 })).resolves.toBeDefined()
    expect(mockRepo.findAll).toHaveBeenCalledOnce()
  })

  it('passes through when only createdAtFrom is given', async () => {
    await expect(service.list('clinic-1', { page: 1, limit: 20, createdAtFrom: '2025-01-01' })).resolves.toBeDefined()
  })

  it('throws INVALID_DATE_RANGE when createdAtFrom > createdAtTo', async () => {
    await expect(
      service.list('clinic-1', { page: 1, limit: 20, createdAtFrom: '2025-12-31', createdAtTo: '2025-01-01' }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' })
    expect(mockRepo.findAll).not.toHaveBeenCalled()
  })

  it('throws DATE_RANGE_TOO_LARGE when interval > 730 days', async () => {
    await expect(
      service.list('clinic-1', { page: 1, limit: 20, createdAtFrom: '2023-01-01', createdAtTo: '2025-12-31' }),
    ).rejects.toMatchObject({ code: 'DATE_RANGE_TOO_LARGE' })
    expect(mockRepo.findAll).not.toHaveBeenCalled()
  })

  it('calls logger.warn when interval is between 181 and 730 days', async () => {
    await service.list('clinic-1', { page: 1, limit: 20, createdAtFrom: '2024-07-01', createdAtTo: '2025-03-01' })
    expect(mockLogger.warn).toHaveBeenCalledOnce()
    expect(mockRepo.findAll).toHaveBeenCalledOnce()
  })

  it('does NOT call logger.warn for interval \u2264 180 days', async () => {
    await service.list('clinic-1', { page: 1, limit: 20, createdAtFrom: '2025-01-01', createdAtTo: '2025-06-01' })
    expect(mockLogger.warn).not.toHaveBeenCalled()
    expect(mockRepo.findAll).toHaveBeenCalledOnce()
  })
})

describe('Double spend simulation', () => {
  it('prevents double spend: only one of two concurrent payments can succeed', async () => {
    // Scenario: wallet balance = 100 (10000 cents)
    // Payment A = 80 (8000), Payment B = 70 (7000)
    // With locking: Payment A succeeds first, reducing balance to 20 (2000)
    // Payment B then reads locked balance = 20 < 70 → throws INSUFFICIENT_BALANCE

    vi.clearAllMocks()
    const service = new WalletService()

    const initialEntry = makeEntry({ balance: 10000 })
    const afterPaymentA = { ...initialEntry, balance: 0, status: 'USED' }

    // First call: Payment A sees full balance of 10000, succeeds
    mockRepo.findByIdForUpdate
      .mockResolvedValueOnce(initialEntry) // Payment A reads 10000
      .mockResolvedValueOnce({ ...initialEntry, balance: 2000 }) // Payment B reads 2000 (after A)

    mockRepo.updateBalance.mockResolvedValue(afterPaymentA)
    mockRepo.createTransaction.mockResolvedValue({})

    // Payment A succeeds
    await expect(service.use('clinic-1', 'entry-1', 8000, 'billing-A')).resolves.toMatchObject({
      remaining: 0,
    })

    // Payment B fails — the locked read returns the reduced balance (2000 < 7000)
    await expect(service.use('clinic-1', 'entry-1', 7000, 'billing-B')).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })
  })
})

describe('WalletService.getSummary()', () => {
  let service: WalletService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WalletService()
  })

  it('retorna totalBalance agregado quando customer pertence à clínica', async () => {
    const { prisma } = await import('../../database/prisma/client')
    ;(prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'customer-1',
      clinicId: 'clinic-1',
    })
    mockRepo.sumActiveBalance.mockResolvedValue(5000)

    const result = await service.getSummary('clinic-1', 'customer-1')

    expect(result).toEqual({ totalBalance: 5000 })
    expect(mockRepo.sumActiveBalance).toHaveBeenCalledWith('clinic-1', 'customer-1')
  })

  it('retorna totalBalance = 0 quando cliente sem entradas ativas', async () => {
    const { prisma } = await import('../../database/prisma/client')
    ;(prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'customer-1',
      clinicId: 'clinic-1',
    })
    mockRepo.sumActiveBalance.mockResolvedValue(0)

    const result = await service.getSummary('clinic-1', 'customer-1')

    expect(result).toEqual({ totalBalance: 0 })
  })

  it('lança 403 quando customerId não pertence à clínica (proteção IDOR)', async () => {
    const { prisma } = await import('../../database/prisma/client')
    ;(prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(service.getSummary('clinic-1', 'customer-outro')).rejects.toMatchObject({
      statusCode: 403,
    })

    expect(mockRepo.sumActiveBalance).not.toHaveBeenCalled()
  })
})

// ─── T11-T13: RN10 + T13 Expiração + SEC04 ─────────────────────────────────────
describe('WalletService.use() — RN10 serviceId + T13 expiração', () => {
  let service: WalletService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WalletService()
  })

  // T11 — VOUCHER_NOT_APPLICABLE_FOR_SERVICE
  it('T11: lança VOUCHER_NOT_APPLICABLE_FOR_SERVICE quando voucher.serviceId não coincide com billing.serviceId', async () => {
    const entry = makeEntry({ serviceId: 'service-A', expirationDate: null })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    // billing pertence à clínica mas tem serviceId diferente
    mockTx.billing.findFirst.mockResolvedValue({ id: 'billing-1', clinicId: 'clinic-1', serviceId: 'service-B' })

    await expect(service.use('clinic-1', 'entry-1', 5000, 'billing-1')).rejects.toMatchObject({
      code: 'VOUCHER_NOT_APPLICABLE_FOR_SERVICE',
    })
    expect(mockRepo.updateBalance).not.toHaveBeenCalled()
  })

  // T12 — Voucher genérico (sem serviceId) aceita qualquer billing
  it('T12: não lança quando voucher não tem serviceId (voucher genérico)', async () => {
    const entry = makeEntry({ serviceId: null, balance: 5000, expirationDate: null })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue({ ...entry, balance: 0, status: 'USED' })
    mockRepo.createTransaction.mockResolvedValue({})

    await expect(service.use('clinic-1', 'entry-1', 5000, 'billing-1')).resolves.toBeDefined()
    // billing.findFirst NÃO deve ser chamado quando entry.serviceId é null
    expect(mockTx.billing.findFirst).not.toHaveBeenCalled()
  })

  // T13 — Voucher expirado
  it('T13: lança VOUCHER_EXPIRED quando entry.expirationDate está no passado', async () => {
    const past = new Date(Date.now() - 86_400_000) // ontem
    const entry = makeEntry({ expirationDate: past })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)

    await expect(service.use('clinic-1', 'entry-1', 5000, 'billing-1')).rejects.toMatchObject({
      code: 'VOUCHER_EXPIRED',
    })
    expect(mockRepo.updateBalance).not.toHaveBeenCalled()
  })

  // T12b — Voucher com expirationDate no futuro funciona normalmente
  it('T12b: aceita quando expirationDate está no futuro', async () => {
    const future = new Date(Date.now() + 86_400_000) // amanhã
    const entry = makeEntry({ serviceId: null, balance: 5000, expirationDate: future })
    mockRepo.findByIdForUpdate.mockResolvedValue(entry)
    mockRepo.updateBalance.mockResolvedValue({ ...entry, balance: 0, status: 'USED' })
    mockRepo.createTransaction.mockResolvedValue({})

    await expect(service.use('clinic-1', 'entry-1', 5000, 'billing-1')).resolves.toBeDefined()
  })
})

// ─── T14: findActiveServiceVouchers SEC03 ─────────────────────────────────────
describe('WalletService.findActiveServiceVouchers()', () => {
  let service: WalletService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WalletService()
  })

  it('T14: lança 403 quando customerId não pertence à clínica (SEC03)', async () => {
    const { prisma } = await import('../../database/prisma/client')
    ;(prisma.customer.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      service.findActiveServiceVouchers('clinic-1', 'customer-outro'),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

