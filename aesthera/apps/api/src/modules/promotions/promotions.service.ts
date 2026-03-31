import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import type {
  ApplyPromotionDto,
  CreatePromotionDto,
  ListPromotionsQuery,
  TogglePromotionStatusDto,
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
      throw new AppError('Código de promoção já existe', 409, 'PROMOTION_CODE_EXISTS')
    }
    return this.repo.create(clinicId, dto)
  }

  async update(clinicId: string, id: string, dto: UpdatePromotionDto) {
    await this.get(clinicId, id)
    return this.repo.update(clinicId, id, dto)
  }

  async toggleStatus(clinicId: string, id: string, dto: TogglePromotionStatusDto) {
    const promotion = await this.repo.findById(clinicId, id)
    if (!promotion) throw new NotFoundError('Promotion')
    return this.repo.toggleStatus(id, dto.active)
  }

  async findActiveForService(clinicId: string, serviceId: string) {
    return this.repo.findActiveForService(clinicId, serviceId)
  }

  /**
   * Validate a promotion code and return the discount amount.
   * Throws descriptive PT-BR errors for authenticated users.
   */
  async validate(
    clinicId: string,
    code: string,
    billingAmount: number,
    serviceIds: string[],
    customerId?: string,
    isPackageSale = false,
  ): Promise<{ promotion: NonNullable<Awaited<ReturnType<PromotionsRepository['findByCode']>>>; discountAmount: number }> {
    const promotion = await this.repo.findByCode(clinicId, code)
    if (!promotion) throw new AppError('Cupom não encontrado.', 404, 'PROMOTION_NOT_FOUND')

    // Coupons are not applicable to package sales
    if (isPackageSale) {
      throw new AppError('Cupons não são aplicáveis a vendas de pacote.', 400, 'PROMOTION_NOT_APPLICABLE_PACKAGE')
    }

    const now = new Date()

    if (promotion.status === 'inactive') {
      throw new AppError('Este cupom está inativo.', 400, 'PROMOTION_INACTIVE')
    }

    if (promotion.status === 'expired' || (promotion.validUntil && promotion.validUntil < now)) {
      throw new AppError('Este cupom está expirado.', 400, 'PROMOTION_EXPIRED')
    }

    if (promotion.validFrom > now) {
      throw new AppError('Este cupom ainda não está válido.', 400, 'PROMOTION_NOT_YET_VALID')
    }

    if (promotion.maxUses !== null && promotion.usesCount >= promotion.maxUses) {
      throw new AppError('Limite global de usos atingido.', 400, 'PROMOTION_MAX_USES_REACHED')
    }

    if (promotion.minAmount !== null && billingAmount < promotion.minAmount) {
      throw new AppError('Valor mínimo não atingido para este cupom.', 400, 'PROMOTION_MIN_AMOUNT')
    }

    // maxUsesPerCustomer check
    if (customerId && promotion.maxUsesPerCustomer !== null && promotion.maxUsesPerCustomer !== undefined) {
      const customerUses = await this.repo.countCustomerUsage(promotion.id, customerId)
      if (customerUses >= promotion.maxUsesPerCustomer) {
        throw new AppError(
          'Você já utilizou este cupom o número máximo de vezes.',
          400,
          'PROMOTION_CUSTOMER_LIMIT_REACHED',
        )
      }
    }

    // Check applicable services (if list is non-empty, at least one service must match)
    if (promotion.applicableServiceIds.length > 0 && serviceIds.length > 0) {
      const hasMatch = serviceIds.some((id) => promotion.applicableServiceIds.includes(id))
      if (!hasMatch) {
        throw new AppError('Este cupom não é válido para este serviço.', 400, 'PROMOTION_SERVICE_MISMATCH')
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
   * Apply a promotion to a billing — creates usage record atomically.
   * Uses conditional updateMany to prevent exceeding maxUses under concurrency.
   */
  async apply(
    clinicId: string,
    dto: ApplyPromotionDto & { billingAmount: number; serviceIds?: string[]; customerId: string },
  ): Promise<{ discountAmount: number }> {
    const { promotion, discountAmount } = await this.validate(
      clinicId,
      dto.code,
      dto.billingAmount,
      dto.serviceIds ?? [],
      dto.customerId,
    )

    // Atomic increment FIRST — only if still under maxUses (prevents race condition)
    // Must run before createUsage to guarantee consistency: if this fails, no usage is recorded
    if (promotion.maxUses !== null) {
      const updated = await prisma.promotion.updateMany({
        where: { id: promotion.id, usesCount: { lt: promotion.maxUses } },
        data: { usesCount: { increment: 1 } },
      })
      if (updated.count === 0) {
        throw new AppError('Limite de usos foi atingido concorrentemente.', 409, 'PROMOTION_MAX_USES_REACHED')
      }
    } else {
      await this.repo.incrementUsage(promotion.id)
    }

    // Only create usage record after increment succeeds
    await this.repo.createUsage({
      clinicId,
      promotionId: promotion.id,
      customerId: dto.customerId,
      billingId: dto.billingId,
      discountAmount,
    })

    return { discountAmount }
  }
}
