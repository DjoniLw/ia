import { z } from 'zod'

export const CreateCustomerDto = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    document: z.string().optional(),
    birthDate: z.string().optional(),
    notes: z.string().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
      })
      .optional(),
  })
  .refine((d) => d.email || d.phone, {
    message: 'Either email or phone must be provided',
  })
export type CreateCustomerDto = z.infer<typeof CreateCustomerDto>

export const UpdateCustomerDto = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional(),
})
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerDto>

export const ListCustomersQuery = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListCustomersQuery = z.infer<typeof ListCustomersQuery>
