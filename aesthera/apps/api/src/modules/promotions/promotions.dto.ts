import { z } from 'zod'

const dateTransform = (v: string) =>
  v.length === 10 ? `${v}T00:00:00.000Z` : v

const dateUntilTransform = (v: string) =>
  v.length === 10 ? `${v}T23:59:59.999Z` : v

export const CreatePromotionDto = z.object({
  name: z.string().min(1),
  code: z.string().min(1).toUpperCase(),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().int().positive(),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerCustomer: z.number().int().positive().optional().nullable(),
  minAmount: z.number().int().min(0).optional(),
  applicableServiceIds: z.array(z.string().uuid()).default([]),
  applicableProductIds: z.array(z.string().uuid()).default([]),
  validFrom: z.string().min(1).transform(dateTransform).pipe(z.string().datetime()),
  validUntil: z.string().min(1).transform(dateUntilTransform).pipe(z.string().datetime()).optional(),
})
export type CreatePromotionDto = z.infer<typeof CreatePromotionDto>

export const UpdatePromotionDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  maxUses: z.number().int().positive().optional().nullable(),
  maxUsesPerCustomer: z.number().int().positive().optional().nullable(),
  applicableServiceIds: z.array(z.string().uuid()).optional(),
  applicableProductIds: z.array(z.string().uuid()).optional(),
  validUntil: z.string().min(1).transform(dateUntilTransform).pipe(z.string().datetime()).optional().nullable(),
})
export type UpdatePromotionDto = z.infer<typeof UpdatePromotionDto>

export const ListPromotionsQuery = z.object({
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  search: z.string().optional(),
  serviceId: z.string().uuid().optional(),
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
  customerId: z.string().uuid().optional(),
})
export type ValidatePromotionDto = z.infer<typeof ValidatePromotionDto>

export const TogglePromotionStatusDto = z.object({
  active: z.boolean(),
})
export type TogglePromotionStatusDto = z.infer<typeof TogglePromotionStatusDto>
