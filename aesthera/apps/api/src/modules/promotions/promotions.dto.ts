import { z } from 'zod'

export const CreatePromotionDto = z.object({
  name: z.string().min(1),
  code: z.string().min(1).toUpperCase(),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().int().positive(),
  maxUses: z.number().int().positive().optional(),
  minAmount: z.number().int().min(0).optional(),
  applicableServiceIds: z.array(z.string().uuid()).default([]),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
})
export type CreatePromotionDto = z.infer<typeof CreatePromotionDto>

export const UpdatePromotionDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  maxUses: z.number().int().positive().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
})
export type UpdatePromotionDto = z.infer<typeof UpdatePromotionDto>

export const ListPromotionsQuery = z.object({
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListPromotionsQuery = z.infer<typeof ListPromotionsQuery>

export const ApplyPromotionDto = z.object({
  code: z.string().min(1),
  billingId: z.string().uuid(),
  customerId: z.string().uuid(),
})
export type ApplyPromotionDto = z.infer<typeof ApplyPromotionDto>

export const ValidatePromotionDto = z.object({
  code: z.string().min(1),
  billingAmount: z.number().int().positive(),
  serviceIds: z.array(z.string().uuid()).default([]),
})
export type ValidatePromotionDto = z.infer<typeof ValidatePromotionDto>
