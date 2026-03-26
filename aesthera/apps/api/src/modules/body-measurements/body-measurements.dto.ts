import { z } from 'zod'

// ─── Fields ───────────────────────────────────────────────────────────────────

export const CreateFieldDto = z.object({
  name: z.string().min(1).max(100),
  unit: z.string().min(1).max(20),
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

// ─── Records ──────────────────────────────────────────────────────────────────

export const CreateRecordDto = z.object({
  customerId: z.string().uuid(),
  recordedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)')
    .refine((v) => Number.isFinite(Date.parse(v)), 'Data inválida'),
  notes: z.string().max(2000).optional(),
  values: z
    .array(
      z.object({
        fieldId: z.string().uuid(),
        value: z.number(),
      }),
    )
    .min(0),
  fileIds: z.array(z.string().uuid()).optional().default([]),
})
export type CreateRecordDto = z.infer<typeof CreateRecordDto>

export const ListRecordsQuery = z.object({
  customerId: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListRecordsQuery = z.infer<typeof ListRecordsQuery>

export const MAX_ACTIVE_FIELDS = 30
