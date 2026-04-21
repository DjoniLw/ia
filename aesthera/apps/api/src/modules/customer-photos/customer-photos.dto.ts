import { z } from 'zod'

// ─── Constantes ──────────────────────────────────────────────────────────────

export const PHOTO_CATEGORIES = [
  'BEFORE_PHOTO',
  'AFTER_PHOTO',
  'PROGRESS_PHOTO',
  'GALLERY_PHOTO',
] as const
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]

export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB
export const MAX_PHOTOS_PER_REQUEST = 5
export const PHOTO_UPLOAD_URL_TTL_SECONDS = 3600
export const PHOTO_UPLOAD_RATE_LIMIT = { max: 20, window: '10m' } as const
export const MAX_BODY_REGIONS = 30

// ─── Validador de data válida ─────────────────────────────────────────────────

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)')
  .refine((v) => Number.isFinite(Date.parse(v)), 'Data inválida')

// ─── POST /customers/:customerId/photos/upload-url ───────────────────────────

export const RequestUploadUrlItemDto = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/\.(jpe?g|png|webp)$/i, 'Formato não suportado. Envie JPEG, PNG ou WebP'),
  mimeType: z.enum(ALLOWED_PHOTO_MIME_TYPES, {
    errorMap: () => ({
      message: 'Formato não suportado. Envie JPEG, PNG ou WebP',
    }),
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_PHOTO_SIZE_BYTES, 'Arquivo excede o limite de 20 MB'),
})
export type RequestUploadUrlItemDto = z.infer<typeof RequestUploadUrlItemDto>

export const RequestUploadUrlDto = z.object({
  files: z
    .array(RequestUploadUrlItemDto)
    .min(1)
    .max(MAX_PHOTOS_PER_REQUEST, `Selecione no máximo ${MAX_PHOTOS_PER_REQUEST} fotos por vez`),
})
export type RequestUploadUrlDto = z.infer<typeof RequestUploadUrlDto>

// ─── POST /customers/:customerId/photos ──────────────────────────────────────

export const CreatePhotoDto = z.object({
  storageKey: z.string().min(1),
  category: z.enum(PHOTO_CATEGORIES),
  takenAt: isoDateSchema
    .refine(
      (v) => new Date(v) <= new Date(),
      'A data da foto não pode ser no futuro',
    )
    .optional(),
  bodyRegion: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  sessionId: z.string().uuid().optional(),
})
export type CreatePhotoDto = z.infer<typeof CreatePhotoDto>

export const CreatePhotosDto = z.object({
  photos: z
    .array(CreatePhotoDto)
    .min(1)
    .max(MAX_PHOTOS_PER_REQUEST, `Selecione no máximo ${MAX_PHOTOS_PER_REQUEST} fotos por vez`),
})
export type CreatePhotosDto = z.infer<typeof CreatePhotosDto>

// ─── GET /customers/:customerId/photos ───────────────────────────────────────

export const ListPhotosQueryDto = z.object({
  category: z.enum(PHOTO_CATEGORIES).optional(),
  bodyRegion: z.string().max(100).optional(),
  takenAtFrom: isoDateSchema.optional(),
  takenAtTo: isoDateSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
})
export type ListPhotosQueryDto = z.infer<typeof ListPhotosQueryDto>

// ─── DELETE /customers/:customerId/photos/:photoId ───────────────────────────

export const DeletePhotoDto = z.object({
  reason: z
    .string()
    .min(10, 'Justificativa deve ter no mínimo 10 caracteres')
    .max(500),
})
export type DeletePhotoDto = z.infer<typeof DeletePhotoDto>

// ─── PATCH /settings/photo-body-regions ──────────────────────────────────────

export const UpdateBodyRegionsDto = z.object({
  regions: z
    .array(z.string().min(1).max(100))
    .min(0)
    .max(MAX_BODY_REGIONS, `Máximo de ${MAX_BODY_REGIONS} regiões corporais`),
})
export type UpdateBodyRegionsDto = z.infer<typeof UpdateBodyRegionsDto>
