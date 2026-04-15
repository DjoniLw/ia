import { z } from 'zod'

// ─── Fichas ───────────────────────────────────────────────────────────────────

export const CreateSheetDto = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['SIMPLE', 'TABULAR']).default('SIMPLE'),
  order: z.number().int().nonnegative().optional(),
  category: z.enum(['CORPORAL', 'FACIAL', 'DERMATO_FUNCIONAL', 'NUTRICIONAL', 'POSTURAL', 'PERSONALIZADA']).default('CORPORAL'),
  scope: z.enum(['SYSTEM', 'CUSTOMER']).default('SYSTEM'),
  customerId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid().optional(),
}).refine(
  (data) => data.scope !== 'CUSTOMER' || !!data.customerId,
  { message: 'customerId é obrigatório quando scope=CUSTOMER', path: ['customerId'] },
)
export type CreateSheetDto = z.infer<typeof CreateSheetDto>

export const UpdateSheetDto = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  category: z.enum(['CORPORAL', 'FACIAL', 'DERMATO_FUNCIONAL', 'NUTRICIONAL', 'POSTURAL', 'PERSONALIZADA']).optional(),
}).strict()
export type UpdateSheetDto = z.infer<typeof UpdateSheetDto>

export const ListSheetsQuery = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
  scope: z.enum(['SYSTEM', 'CUSTOMER']).optional(),
  category: z.enum(['CORPORAL', 'FACIAL', 'DERMATO_FUNCIONAL', 'NUTRICIONAL', 'POSTURAL', 'PERSONALIZADA']).optional(),
})
export type ListSheetsQuery = z.infer<typeof ListSheetsQuery>

// ─── Colunas (fichas TABULAR) ─────────────────────────────────────────────────

export const CreateSheetColumnDto = z.object({
  name: z.string().min(1).max(100),
  inputType: z.enum(['INPUT', 'CHECK']).default('INPUT'),
  unit: z.string().min(1).max(20).optional(),
  isTextual: z.boolean().default(false),
  defaultValue: z.string().max(500).optional(),
  order: z.number().int().nonnegative().optional(),
})
export type CreateSheetColumnDto = z.infer<typeof CreateSheetColumnDto>

export const UpdateSheetColumnDto = z.object({
  name: z.string().min(1).max(100).optional(),
  inputType: z.enum(['INPUT', 'CHECK']).optional(),
  unit: z.string().min(1).max(20).optional(),
  isTextual: z.boolean().optional(),
  defaultValue: z.string().max(500).nullish(),
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
  isTextual: z.boolean().default(false),
  defaultValue: z.string().max(500).optional(),
  subColumns: z.array(z.string().min(1).max(50)).max(8).default([]),
  order: z.number().int().nonnegative().optional(),
})
export type CreateFieldDto = z.infer<typeof CreateFieldDto>

export const UpdateFieldDto = z.object({
  name: z.string().min(1).max(100).optional(),
  inputType: z.enum(['INPUT', 'CHECK']).optional(),
  unit: z.string().min(1).max(20).optional(),
  isTextual: z.boolean().optional(),
  defaultValue: z.string().max(500).nullish(),
  subColumns: z.array(z.string().min(1).max(50)).max(8).optional(),
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
