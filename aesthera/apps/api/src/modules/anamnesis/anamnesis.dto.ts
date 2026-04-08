import { z } from 'zod'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const AnamnesisRequestMode = z.enum(['blank', 'prefilled'])
export type AnamnesisRequestMode = z.infer<typeof AnamnesisRequestMode>

export const AnamnesisRequestStatus = z.enum([
  'pending',
  'signed',
  'expired',
  'correction_requested',
  'cancelled',
])
export type AnamnesisRequestStatus = z.infer<typeof AnamnesisRequestStatus>

// ─── Dashboard DTOs ───────────────────────────────────────────────────────────

export const CreateAnamnesisRequestDto = z.object({
  customerId: z.string().uuid(),
  mode: AnamnesisRequestMode,
  groupId: z.string().min(1).max(100),
  /** Snapshot do nome do grupo no momento da criação */
  groupName: z.string().min(1).max(200),
  /** Snapshot das perguntas [{ id, label, type, required, options? }] */
  questionsSnapshot: z.array(z.record(z.unknown())).min(1),
  /** Respostas pré-preenchidas pelo staff (apenas para mode=prefilled) */
  staffAnswers: z.record(z.unknown()).optional().nullable(),
  /** Canal de envio: 'whatsapp' | 'email' (apenas para envio remoto) */
  channel: z.enum(['whatsapp', 'email']).optional(),
})
export type CreateAnamnesisRequestDto = z.infer<typeof CreateAnamnesisRequestDto>

export const ListAnamnesisRequestsQuery = z.object({
  customerId: z.string().uuid().optional(),
  status: AnamnesisRequestStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListAnamnesisRequestsQuery = z.infer<typeof ListAnamnesisRequestsQuery>

export const ResendAnamnesisDto = z.object({
  channel: z.enum(['whatsapp', 'email']).optional(),
})
export type ResendAnamnesisDto = z.infer<typeof ResendAnamnesisDto>

// ─── Public DTOs ─────────────────────────────────────────────────────────────

export const PublicSubmitAnamnesisDto = z.object({
  clientAnswers: z.record(z.unknown()),
  /** Base64 PNG da assinatura manuscrita — máx 4.2 MB */
  signature: z
    .string()
    .max(4_200_000, 'Assinatura excede o tamanho máximo permitido.')
    .refine(
      (v) => v.startsWith('data:image/png;base64,'),
      'Formato de assinatura inválido. Esperado PNG em base64.',
    ),
  /** Consentimento LGPD explícito */
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'O consentimento é obrigatório para assinar a anamnese.' }),
  }),
})
export type PublicSubmitAnamnesisDto = z.infer<typeof PublicSubmitAnamnesisDto>

export const PublicRequestCorrectionDto = z.object({
  comment: z.string().min(1).max(500).optional(),
})
export type PublicRequestCorrectionDto = z.infer<typeof PublicRequestCorrectionDto>
