import { z } from 'zod'

export const CreateServiceDto = z.object({
  name: z.string().min(2).max(100),
  description: z.string().nullish(),
  category: z.string().nullish(),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .refine((v) => v % 15 === 0, 'Duration must be a multiple of 15 minutes'),
  price: z.number().int().min(0),
})
export type CreateServiceDto = z.infer<typeof CreateServiceDto>

export const UpdateServiceDto = CreateServiceDto.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateServiceDto = z.infer<typeof UpdateServiceDto>

export const ListServicesQuery = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  active: z
    .string()
    .optional()
    .transform((v) => (v === 'false' ? false : v === 'true' ? true : undefined)),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListServicesQuery = z.infer<typeof ListServicesQuery>
