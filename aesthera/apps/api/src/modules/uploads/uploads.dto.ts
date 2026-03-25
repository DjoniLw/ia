import { z } from 'zod'

// ─── Allowed MIME types ────────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export const ALLOWED_CATEGORIES = [
  'BEFORE_PHOTO',
  'AFTER_PHOTO',
  'MEASUREMENT',
  'EXAM',
  'OTHER',
] as const

export const BODY_DATA_CATEGORIES = ['BEFORE_PHOTO', 'AFTER_PHOTO', 'MEASUREMENT'] as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// ─── Presign ──────────────────────────────────────────────────────────────────

export const PresignDto = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({
      message: 'Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF.',
    }),
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE, 'Tamanho máximo por arquivo: 10 MB'),
  customerId: z.string().uuid(),
  category: z.enum(ALLOWED_CATEGORIES),
})
export type PresignDto = z.infer<typeof PresignDto>

// ─── Confirm ──────────────────────────────────────────────────────────────────

export const ConfirmUploadDto = z.object({
  storageKey: z.string().min(1),
  customerId: z.string().uuid(),
  name: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive(),
  category: z.enum(ALLOWED_CATEGORIES),
})
export type ConfirmUploadDto = z.infer<typeof ConfirmUploadDto>
