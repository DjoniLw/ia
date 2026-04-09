import { z } from 'zod'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const AnamnesisRequestMode = z.enum(['blank', 'prefilled'])
export type AnamnesisRequestMode = z.infer<typeof AnamnesisRequestMode>

export const AnamnesisRequestStatus = z.enum([
  'draft',
  'clinic_filled',
  'sent_to_client',
  'client_submitted',
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
  /** Snapshot das perguntas [{ id, text, type, required, options? }] */
  questionsSnapshot: z.array(z.record(z.unknown())).min(1),
  /** Respostas pré-preenchidas pelo staff (apenas para mode=prefilled) */
  staffAnswers: z.record(z.unknown()).optional().nullable(),
  /** Telefone para envio via WhatsApp (override do telefone do cliente) */
  phone: z.string().min(10, 'Número de telefone inválido').optional(),
  /** E-mail para envio via e-mail (override do e-mail do cliente) */
  email: z.string().email('E-mail inválido').optional(),
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
  /** Telefone para envio via WhatsApp (override do telefone do cliente) */
  phone: z.string().min(10, 'Número de telefone inválido').optional(),
  /** E-mail para envio via e-mail (override do e-mail do cliente) */
  email: z.string().email('E-mail inválido').optional(),
})
export type ResendAnamnesisDto = z.infer<typeof ResendAnamnesisDto>

/** DTO para envio da ficha ao cliente (canais de notificação) */
export const SendAnamnesisDto = z
  .object({
    phone: z.string().min(10, 'Número de telefone inválido').optional(),
    email: z.string().email('E-mail inválido').optional(),
  })
  .refine((data) => Boolean(data.phone ?? data.email), {
    message: 'Informe pelo menos um canal de envio: telefone ou e-mail.',
  })
export type SendAnamnesisDto = z.infer<typeof SendAnamnesisDto>

// ─── Resolve Diff DTO (SEC — transação atômica) ───────────────────────────────

/**
 * ResolveDiffSchema — resolve divergências campo-a-campo.
 * ⛔ consentText: NUNCA declarado aqui — gerado server-side.
 */
export const ResolveDiffSchema = z.object({
  resolutions: z.record(z.enum(['clinic', 'client'])),
})
export type ResolveDiffDto = z.infer<typeof ResolveDiffSchema>

// ─── Public DTOs ─────────────────────────────────────────────────────────────

/**
 * PublicSubmitAnamnesisDto — submissão pública da ficha pelo cliente.
 * ⛔ consentText: NUNCA declarado aqui — poisoning prevention (SEC1/RN17).
 *    O valor SEMPRE vem do banco, nunca do body.
 */
export const PublicSubmitAnamnesisDto = z.object({
  clientAnswers: z
    .record(z.string().max(10_000, 'Máximo de 10.000 caracteres por campo'))
    .refine(
      (obj) => Object.keys(obj).length <= 200,
      { message: 'Número máximo de 200 campos excedido' },
    ),
  /** Base64 PNG da assinatura manuscrita — mínimo 1.000 bytes (trace válido) + prefixo PNG — SEC6 */
  signatureBase64: z
    .string()
    .min(1_000, 'Assinatura inválida — trace mínimo não atingido')
    .refine(
      (v) => v.startsWith('data:image/png;base64,'),
      'Formato de assinatura inválido. Esperado PNG em base64.',
    ),
  /** Consentimento LGPD explícito */
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'O consentimento é obrigatório para assinar a anamnese.' }),
  }),
  // ⛔ consentText: NUNCA declarar aqui — poisoning prevention (SEC1)
})
export type PublicSubmitAnamnesisDto = z.infer<typeof PublicSubmitAnamnesisDto>

export const PublicRequestCorrectionDto = z.object({
  comment: z.string().min(1).max(500).optional(),
})
export type PublicRequestCorrectionDto = z.infer<typeof PublicRequestCorrectionDto>
