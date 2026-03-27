import { z } from 'zod'

// ─── Fichas ───────────────────────────────────────────────────────────────────

export const CreateSheetDto = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['SIMPLE', 'TABULAR']).default('SIMPLE'),
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

// ─── Colunas (fichas TABULAR) ─────────────────────────────────────────────────

export const CreateSheetColumnDto = z.object({
  name: z.string().min(1).max(100),
  inputType: z.enum(['INPUT', 'CHECK']).default('INPUT'),
  unit: z.string().min(1).max(20).optional(),
  order: z.number().int().nonnegative().optional(),
})
export type CreateSheetColumnDto = z.infer<typeof CreateSheetColumnDto>

export const UpdateSheetColumnDto = z.object({
  name: z.string().min(1).max(100).optional(),
  inputType: z.enum(['INPUT', 'CHECK']).optional(),
  unit: z.string().min(1).max(20).optional(),
  order: z.number().int().nonnegative().optional(),
})
export type UpdateSheetColumnDto = z.infer<typeof UpdateSheetColumnDto>

export const ReorderSheetColumnsDto = z.array(
  z.object({
    id: z.string().uuid(),
    order: z.number().int().nonnegative(),
  }),
)
export type ReorderSheetColumnsDto = z.infer<typeof ReorderSheetColumnsDto>

// ─── Campos (linhas da ficha) ─────────────────────────────────────────────────

export const CreateFieldDto = z.object({
  name: z.string().min(1).max(100),
  inputType: z.enum(['INPUT', 'CHECK']).default('INPUT'),
  unit: z.string().min(1).max(20).optional(),
  order: z.number().int().nonnegative().optional(),
})
export type CreateFieldDto = z.infer<typeof CreateFieldDto>

export const UpdateFieldDto = z.object({
  name: z.string().min(1).max(100).optional(),
  inputType: z.enum(['INPUT', 'CHECK']).optional(),
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

export const ReorderSheetsDto = z.array(
  z.object({
    id: z.string().uuid(),
    order: z.number().int().nonnegative(),
  }),
)
export type ReorderSheetsDto = z.infer<typeof ReorderSheetsDto>

// ─── Constantes ───────────────────────────────────────────────────────────────

export const MAX_ACTIVE_SHEETS = 20
export const MAX_ACTIVE_FIELDS = 30
export const MAX_SHEET_COLUMNS = 10
