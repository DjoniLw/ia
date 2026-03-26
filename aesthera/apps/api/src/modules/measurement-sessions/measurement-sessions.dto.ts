import { z } from 'zod'

// ─── Criação de Sessão ────────────────────────────────────────────────────────

const SheetRecordDto = z.object({
  sheetId: z.string().uuid(),
  values: z
    .array(z.object({ fieldId: z.string().uuid(), value: z.number() }))
    .optional()
    .default([]),
  tabularValues: z
    .array(
      z.object({
        fieldId: z.string().uuid(),
        columnId: z.string().uuid(),
        value: z.number(),
      }),
    )
    .optional()
    .default([]),
})

export const CreateSessionDto = z.object({
  customerId: z.string().uuid(),
  recordedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)')
    .refine((v) => Number.isFinite(Date.parse(v)), 'Data inválida'),
  notes: z.string().max(2000).optional(),
  sheetRecords: z.array(SheetRecordDto).min(1),
  fileIds: z.array(z.string().uuid()).optional().default([]),
})
export type CreateSessionDto = z.infer<typeof CreateSessionDto>

export const UpdateSessionDto = z.object({
  recordedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)')
    .refine((v) => Number.isFinite(Date.parse(v)), 'Data inválida')
    .optional(),
  notes: z.string().max(2000).nullish(),
  sheetRecords: z.array(SheetRecordDto).optional(),
  fileIds: z.array(z.string().uuid()).optional(),
})
export type UpdateSessionDto = z.infer<typeof UpdateSessionDto>

export const ListSessionsQuery = z.object({
  customerId: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListSessionsQuery = z.infer<typeof ListSessionsQuery>
