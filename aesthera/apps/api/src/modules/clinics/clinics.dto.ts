import { z } from 'zod'

const optionalCnpjSchema = z
  .string()
  .optional()
  .refine((value) => {
    if (value === undefined) return true
    const digits = value.replace(/\D/g, '')
    return digits.length === 0 || digits.length === 14
  }, 'CNPJ deve ter 14 dígitos')

export const UpdateClinicDto = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  document: optionalCnpjSchema,
  timezone: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional(),
  settings: z.record(z.unknown()).optional(),
})

export type UpdateClinicDto = z.infer<typeof UpdateClinicDto>

const BusinessHourItemDto = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  isOpen: z.boolean(),
})

export const SetBusinessHoursDto = z.object({
  hours: z.array(BusinessHourItemDto).min(1).max(7),
})

export type SetBusinessHoursDto = z.infer<typeof SetBusinessHoursDto>
