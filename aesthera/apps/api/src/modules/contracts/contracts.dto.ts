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

export const SendRemoteSignDto = z.object({
  phone: z.string().min(10, 'Telefone inválido (mín. 10 dígitos)').optional(),
  email: z.string().email('E-mail inválido').optional(),
}).refine(
  (d) => d.phone || d.email,
  { message: 'Informe ao menos um telefone ou e-mail' },
)
export type SendRemoteSignDto = z.infer<typeof SendRemoteSignDto>

// Limite de ~3 MB em base64 (4/3 × 3_145_728 ≈ 4_194_304 chars)
const MAX_SIGNATURE_LENGTH = 4_200_000

export const SignRemoteDto = z.object({
  signature: z
    .string()
    .min(1, 'Assinatura é obrigatória')
    .max(MAX_SIGNATURE_LENGTH, 'Assinatura muito grande (máx. 3 MB)')
    .refine(
      (v) =>
        v.startsWith('data:image/png;base64,') ||
        v.startsWith('data:image/jpeg;base64,') ||
        v.startsWith('data:image/jpg;base64,'),
      'Formato de assinatura inválido (esperado: data:image/png;base64,...)',
    ),
})
export type SignRemoteDto = z.infer<typeof SignRemoteDto>

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

// ─── Contract WhatsApp ───────────────────────────────────────────────────────

export const SendContractWhatsAppDto = z.object({
  phone: z.string().min(10, 'Telefone inválido (mín. 10 dígitos)'),
})
export type SendContractWhatsAppDto = z.infer<typeof SendContractWhatsAppDto>
// ─── Upload de Contrato Assinado (físico/escaneado) ───────────────────────────────────────

export const PresignSignedContractDto = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf'], {
    errorMap: () => ({ message: 'Apenas arquivos PDF são aceitos.' }),
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024, 'Tamanho máximo: 20 MB'),
})
export type PresignSignedContractDto = z.infer<typeof PresignSignedContractDto>

export const ConfirmSignedUploadDto = z.object({
  storageKey: z.string().min(1, 'storageKey é obrigatório'),
})
export type ConfirmSignedUploadDto = z.infer<typeof ConfirmSignedUploadDto>

// ─── Upload avulso de contrato já assinado (sem template) ──────────────────────

export const PresignStandaloneSignedDto = z.object({
  label: z.string().min(1, 'Nome do documento é obrigatório').max(255),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf'], {
    errorMap: () => ({ message: 'Apenas arquivos PDF são aceitos.' }),
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024, 'Tamanho máximo: 20 MB'),
})
export type PresignStandaloneSignedDto = z.infer<typeof PresignStandaloneSignedDto>

export const ConfirmStandaloneSignedDto = z.object({
  label: z.string().min(1, 'Nome do documento é obrigatório').max(255),
  storageKey: z.string().min(1, 'storageKey é obrigatório'),
})
export type ConfirmStandaloneSignedDto = z.infer<typeof ConfirmStandaloneSignedDto>
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
