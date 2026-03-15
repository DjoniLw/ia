import { z } from 'zod'

export const CreateSupplyDto = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional().nullable(),
  unit: z.string().default('un'),
  costPrice: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
})
export type CreateSupplyDto = z.infer<typeof CreateSupplyDto>

export const UpdateSupplyDto = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional().nullable(),
  unit: z.string().optional(),
  costPrice: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})
export type UpdateSupplyDto = z.infer<typeof UpdateSupplyDto>

export const ListSuppliesQuery = z.object({
  name: z.string().optional(),
  active: z
    .string()
    .optional()
    .transform((v) => (v === 'false' ? false : v === 'true' ? true : undefined)),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListSuppliesQuery = z.infer<typeof ListSuppliesQuery>

// Service <-> Supply assignment
export const AssignSuppliesDto = z.object({
  supplies: z.array(
    z.object({
      supplyId: z.string().uuid(),
      quantity: z.number().positive(),
    }),
  ),
})
export type AssignSuppliesDto = z.infer<typeof AssignSuppliesDto>
