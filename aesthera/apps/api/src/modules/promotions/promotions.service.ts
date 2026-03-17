import { AppError, NotFoundError } from '../../shared/errors/app-error'
import type {
  ApplyPromotionDto,
  CreatePromotionDto,
  ListPromotionsQuery,
  UpdatePromotionDto,
} from './promotions.dto'
import { PromotionsRepository } from './promotions.repository'

export class PromotionsService {
  private repo = new PromotionsRepository()

  async list(clinicId: string, q: ListPromotionsQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const promotion = await this.repo.findById(clinicId, id)
    if (!promotion) throw new NotFoundError('Promotion')
    return promotion
  }

  async create(clinicId: string, dto: CreatePromotionDto) {
    const existing = await this.repo.findByCode(clinicId, dto.code)
    if (existing) {
      throw new AppError('Promotion code already exists', 409, 'PROMOTION_CODE_EXISTS')
    }
    return this.repo.create(clinicId, dto)
  }

  async update(clinicId: string, id: string, dto: UpdatePromotionDto) {
    await this.get(clinicId, id)
    return this.repo.update(clinicId, id, dto)
  }

  /**
   * Validate a promotion code and return the discount amount.
   * Throws if the code is invalid, expired, exhausted or doesn't meet requirements.
   */
  async validate(
    clinicId: string,
    code: string,
    billingAmount: number,
    serviceIds: string[],
  ): Promise<{ promotion: Awaited<ReturnType<PromotionsRepository['findByCode']>>; discountAmount: number }> {
    const promotion = await this.repo.findByCode(clinicId, code)
    if (!promotion) throw new NotFoundError('Promotion')

    const now = new Date()

    if (promotion.status === 'inactive') {
      throw new AppError('Promotion is inactive', 400, 'PROMOTION_INACTIVE')
    }

    if (promotion.status === 'expired' || (promotion.validUntil && promotion.validUntil < now)) {
      throw new AppError('Promotion has expired', 400, 'PROMOTION_EXPIRED')
    }

    if (promotion.validFrom > now) {
      throw new AppError('Promotion is not yet valid', 400, 'PROMOTION_NOT_YET_VALID')
    }

    if (promotion.maxUses !== null && promotion.usesCount >= promotion.maxUses) {
      throw new AppError('Promotion usage limit reached', 400, 'PROMOTION_MAX_USES_REACHED')
    }

    if (promotion.minAmount !== null && billingAmount < promotion.minAmount) {
      throw new AppError(
        `Minimum billing amount of ${promotion.minAmount} cents required`,
        400,
        'PROMOTION_MIN_AMOUNT_NOT_MET',
      )
    }

    // Check applicable services (if list is non-empty, at least one service must match)
    if (promotion.applicableServiceIds.length > 0 && serviceIds.length > 0) {
      const hasMatch = serviceIds.some((id) => promotion.applicableServiceIds.includes(id))
      if (!hasMatch) {
        throw new AppError('Promotion is not applicable to these services', 400, 'PROMOTION_NOT_APPLICABLE')
      }
    }

    let discountAmount: number
    if (promotion.discountType === 'PERCENTAGE') {
      discountAmount = Math.floor((billingAmount * promotion.discountValue) / 100)
    } else {
      discountAmount = Math.min(promotion.discountValue, billingAmount)
    }

    return { promotion, discountAmount }
  }

  /**
   * Apply a promotion to a billing — creates usage record and returns discount amount.
   */
  async apply(
    clinicId: string,
    dto: ApplyPromotionDto & { billingAmount: number; serviceIds?: string[] },
  ): Promise<{ discountAmount: number }> {
    const { promotion, discountAmount } = await this.validate(
      clinicId,
      dto.code,
      dto.billingAmount,
      dto.serviceIds ?? [],
    )

    await this.repo.createUsage({
      clinicId,
      promotionId: promotion.id,
      customerId: dto.customerId,
      billingId: dto.billingId,
      discountAmount,
    })

    await this.repo.incrementUsage(promotion.id)

    return { discountAmount }
  }
}
