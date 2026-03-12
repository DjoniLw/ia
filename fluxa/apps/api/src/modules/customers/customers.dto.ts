import { z } from 'zod'

export const CreateCustomerDto = z.object({
  externalId: z.string().optional(),
  name: z.string().min(2).max(150),
  email: z.string().email().optional(),
  document: z.string().optional(), // CPF or CNPJ
  phone: z.string().optional(),
  address: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const UpdateCustomerDto = z.object({
  name: z.string().min(2).max(150).optional(),
  email: z.string().email().optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  address: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const ListCustomersDto = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  sort: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export type CreateCustomerDto = z.infer<typeof CreateCustomerDto>
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerDto>
export type ListCustomersDto = z.infer<typeof ListCustomersDto>
