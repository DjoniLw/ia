import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist shared mocks so they are available before vi.mock hoisting ───────
const mockTx = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([]),
  walletEntry: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  walletTransaction: { create: vi.fn() },
}))

const mockRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByIdForUpdate: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  updateBalance: vi.fn(),
  createTransaction: vi.fn(),
}))

// ─── Mock the Prisma client ─────────────────────────────────────────────────
vi.mock('../../database/prisma/client', () => ({
  prisma: {
    $transaction: vi.fn(async function (fn: (tx: unknown) => Promise<unknown>) {
      return fn(mockTx)
    }),
  },
}))

// ─── Mock the WalletRepository ──────────────────────────────────────────────
vi.mock('./wallet.repository', () => ({
  WalletRepository: vi.fn(function () {
    return mockRepo
  }),
}))

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
