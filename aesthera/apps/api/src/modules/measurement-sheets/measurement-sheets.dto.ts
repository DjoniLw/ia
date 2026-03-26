import { z } from 'zod'

// ─── Fichas ───────────────────────────────────────────────────────────────────

export const CreateSheetDto = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().nonnegative().optional(),
})
export type CreateSheetDto = z.infer<typeof CreateSheetDto>

export const UpdateSheetDto = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
})
export type UpdateSheetDto = z.infer<typeof UpdateSheetDto>

export const ListSheetsQuery = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
})
export type ListSheetsQuery = z.infer<typeof ListSheetsQuery>

// ─── Campos ───────────────────────────────────────────────────────────────────

export const CreateFieldDto = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['SIMPLE', 'TABULAR']),
  unit: z.string().min(1).max(20).optional(),
  order: z.number().int().nonnegative().optional(),
})
export type CreateFieldDto = z.infer<typeof CreateFieldDto>

export const UpdateFieldDto = z.object({
  name: z.string().min(1).max(100).optional(),
  unit: z.string().min(1).max(20).optional(),
  order: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
})
export type UpdateFieldDto = z.infer<typeof UpdateFieldDto>

export const ReorderFieldsDto = z.array(
  z.object({
    id: z.string().uuid(),
    order: z.number().int().nonnegative(),
  }),
)
export type ReorderFieldsDto = z.infer<typeof ReorderFieldsDto>

// ─── Sub-colunas ──────────────────────────────────────────────────────────────

export const CreateSubColumnDto = z.object({
  name: z.string().min(1).max(100),
  unit: z.string().min(1).max(20),
  order: z.number().int().nonnegative().optional(),
})
export type CreateSubColumnDto = z.infer<typeof CreateSubColumnDto>

export const UpdateSubColumnDto = z.object({
  name: z.string().min(1).max(100).optional(),
  unit: z.string().min(1).max(20).optional(),
  order: z.number().int().nonnegative().optional(),
})
export type UpdateSubColumnDto = z.infer<typeof UpdateSubColumnDto>

// ─── Constantes ───────────────────────────────────────────────────────────────

export const MAX_ACTIVE_SHEETS = 20
export const MAX_ACTIVE_FIELDS = 30
export const MAX_SUB_COLUMNS = 10
