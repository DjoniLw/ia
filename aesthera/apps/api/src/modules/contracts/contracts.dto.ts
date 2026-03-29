import { z } from 'zod'

// ─── Contract Template DTOs ────────────────────────────────────────────────────

export const CreateContractTemplateDto = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
  description: z.string().max(1000).optional(),
  storageKey: z.string().optional(),
})
export type CreateContractTemplateDto = z.infer<typeof CreateContractTemplateDto>

export const UpdateContractTemplateDto = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  storageKey: z.string().nullable().optional(),
  active: z.boolean().optional(),
})
export type UpdateContractTemplateDto = z.infer<typeof UpdateContractTemplateDto>

// ─── Customer Contract DTOs ────────────────────────────────────────────────────

export const CreateCustomerContractDto = z.object({
  templateId: z.string().uuid('templateId inválido'),
})
export type CreateCustomerContractDto = z.infer<typeof CreateCustomerContractDto>

export const SendAssinafyDto = z.object({
  customerEmail: z.string().email('E-mail inválido').optional(),
})
export type SendAssinafyDto = z.infer<typeof SendAssinafyDto>

export const SignManualDto = z.object({
  signature: z
    .string()
    .min(1, 'Assinatura é obrigatória')
    .refine(
      (v) => v.startsWith('data:image/') || /^[A-Za-z0-9+/]/.test(v),
      'Formato de assinatura inválido',
    ),
})
export type SignManualDto = z.infer<typeof SignManualDto>

// ─── Assinafy Webhook ──────────────────────────────────────────────────────────

export const AssinafyWebhookDto = z.object({
  contractId: z.string().uuid(),
  externalId: z.string().optional(),
  signedAt: z
    .string()
    .refine((v) => Number.isFinite(Date.parse(v)), 'Data inválida'),
  signedPdfUrl: z.string().url().optional(),
})
export type AssinafyWebhookDto = z.infer<typeof AssinafyWebhookDto>

// ─── Template Presign ──────────────────────────────────────────────────────────

export const TemplatePresignDto = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], {
    errorMap: () => ({ message: 'Tipo de arquivo não permitido. Use PDF ou DOC.' }),
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024, 'Tamanho máximo: 20 MB'),
})
export type TemplatePresignDto = z.infer<typeof TemplatePresignDto>
