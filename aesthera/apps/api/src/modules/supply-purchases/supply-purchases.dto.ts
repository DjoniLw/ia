import { z } from 'zod'

export const CreateSupplyPurchaseDto = z.object({
  supplyId: z.string().uuid(),
  supplierName: z.string().trim().max(160).optional().nullable(),
  purchaseUnit: z.string().trim().min(1).max(50),
  purchaseQty: z.number().positive(),
  conversionFactor: z.number().positive(),
  unitCost: z.number().int().min(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  purchasedAt: z.string().datetime(),
})
export type CreateSupplyPurchaseDto = z.infer<typeof CreateSupplyPurchaseDto>

export const ListSupplyPurchasesQuery = z.object({
  supplyId: z.string().uuid().optional(),
  supplierName: z.string().trim().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListSupplyPurchasesQuery = z.infer<typeof ListSupplyPurchasesQuery>