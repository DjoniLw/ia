import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist mocks ─────────────────────────────────────────────────────────────

const mockRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  toggleStatus: vi.fn(),
  findActiveForService: vi.fn(),
  countCustomerUsage: vi.fn(),
  createUsage: vi.fn(),
  incrementUsage: vi.fn(),
}))

vi.mock('../../database/prisma/client', () => ({
  prisma: {
    promotion: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}))

vi.mock('./promotions.repository', () => ({
  PromotionsRepository: vi.fn(function () { return mockRepo }),
}))

import { PromotionsService } from './promotions.service'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CLINIC_ID = 'clinic-1'
const NOW = new Date()

function makePromotion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-1',
    clinicId: CLINIC_ID,
    code: 'SUMMER20',
    name: 'Verão 20%',
    status: 'active',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxUses: null,
    maxUsesPerCustomer: null,
    usesCount: 0,
    minAmount: null,
    applicableServiceIds: [],
    validFrom: new Date(NOW.getTime() - 86400000), // ontem
    validUntil: new Date(NOW.getTime() + 86400000), // amanhã
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PromotionsService', () => {
  let svc: PromotionsService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new PromotionsService()
  })

  // ──── validate ────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('lança NOT_FOUND se promoção não existir', async () => {
      mockRepo.findByCode.mockResolvedValue(null)

      await expect(svc.validate(CLINIC_ID, 'INVALIDO', 10000, [])).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('lança PROMOTION_INACTIVE se status for inactive', async () => {
      mockRepo.findByCode.mockResolvedValue(makePromotion({ status: 'inactive' }))

      await expect(svc.validate(CLINIC_ID, 'SUMMER20', 10000, [])).rejects.toMatchObject({
        code: 'PROMOTION_INACTIVE',
      })
    })

    it('lança PROMOTION_EXPIRED se validUntil for no passado', async () => {
      mockRepo.findByCode.mockResolvedValue(
        makePromotion({ validUntil: new Date(NOW.getTime() - 100000) }),
      )

      await expect(svc.validate(CLINIC_ID, 'SUMMER20', 10000, [])).rejects.toMatchObject({
        code: 'PROMOTION_EXPIRED',
      })
    })

    it('lança PROMOTION_MAX_USES_REACHED se usesCount >= maxUses', async () => {
      mockRepo.findByCode.mockResolvedValue(makePromotion({ maxUses: 5, usesCount: 5 }))

      await expect(svc.validate(CLINIC_ID, 'SUMMER20', 10000, [])).rejects.toMatchObject({
        code: 'PROMOTION_MAX_USES_REACHED',
      })
    })

    it('lança PROMOTION_MIN_AMOUNT se valor for abaixo do mínimo', async () => {
      mockRepo.findByCode.mockResolvedValue(makePromotion({ minAmount: 20000 }))

      await expect(svc.validate(CLINIC_ID, 'SUMMER20', 5000, [])).rejects.toMatchObject({
        code: 'PROMOTION_MIN_AMOUNT',
      })
    })

    it('lança PROMOTION_CUSTOMER_LIMIT_REACHED se cliente excedeu limite por cliente', async () => {
      mockRepo.findByCode.mockResolvedValue(makePromotion({ maxUsesPerCustomer: 1 }))
      mockRepo.countCustomerUsage.mockResolvedValue(1)

      await expect(
        svc.validate(CLINIC_ID, 'SUMMER20', 10000, [], 'cust-1'),
      ).rejects.toMatchObject({ code: 'PROMOTION_CUSTOMER_LIMIT_REACHED' })
    })

    it('lança PROMOTION_NOT_APPLICABLE_PACKAGE se isPackageSale=true', async () => {
      mockRepo.findByCode.mockResolvedValue(makePromotion())

      await expect(
        svc.validate(CLINIC_ID, 'SUMMER20', 10000, [], undefined, true),
      ).rejects.toMatchObject({ code: 'PROMOTION_NOT_APPLICABLE_PACKAGE' })
    })

    it('lança SERVICE_MISMATCH se promoção tiver serviços restritos e nenhum coincidir', async () => {
      mockRepo.findByCode.mockResolvedValue(
        makePromotion({ applicableServiceIds: ['svc-A', 'svc-B'] }),
      )

      await expect(
        svc.validate(CLINIC_ID, 'SUMMER20', 10000, ['svc-C']),
      ).rejects.toMatchObject({ code: 'PROMOTION_SERVICE_MISMATCH' })
    })

    it('calcula desconto percentual corretamente', async () => {
      mockRepo.findByCode.mockResolvedValue(makePromotion({ discountValue: 20, discountType: 'PERCENTAGE' }))

      const result = await svc.validate(CLINIC_ID, 'SUMMER20', 10000, [])

      expect(result.discountAmount).toBe(2000) // 20% de 10000
    })

    it('calcula desconto fixo corretamente limitado ao billingAmount', async () => {
      mockRepo.findByCode.mockResolvedValue(
        makePromotion({ discountValue: 50000, discountType: 'FIXED' }),
      )

      const result = await svc.validate(CLINIC_ID, 'SUMMER20', 10000, [])

      expect(result.discountAmount).toBe(10000) // limitado ao valor total
    })
  })

  // ──── toggleStatus ────────────────────────────────────────────────────────

  describe('toggleStatus()', () => {
    it('lança NOT_FOUND se promoção não existir', async () => {
      mockRepo.findById.mockResolvedValue(null)

      await expect(svc.toggleStatus(CLINIC_ID, 'inexistente', { active: false })).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('chama repo.toggleStatus com valor correto', async () => {
      mockRepo.findById.mockResolvedValue(makePromotion())
      mockRepo.toggleStatus.mockResolvedValue({ ...makePromotion(), status: 'inactive' })

      await svc.toggleStatus(CLINIC_ID, 'promo-1', { active: false })

      expect(mockRepo.toggleStatus).toHaveBeenCalledWith('promo-1', false)
    })
  })
})
