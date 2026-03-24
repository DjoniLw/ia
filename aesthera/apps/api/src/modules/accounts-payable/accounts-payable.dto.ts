import { z } from 'zod'

export const ListAccountsPayableQuery = z.object({
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.string().trim().min(1).optional(),
  supplierName: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListAccountsPayableQuery = z.infer<typeof ListAccountsPayableQuery>

export const CreateAccountsPayableDto = z.object({
  description: z.string().trim().min(1),
  supplierName: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  amount: z.number().int().positive(),
  dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes: z.string().optional(),
})
export type CreateAccountsPayableDto = z.infer<typeof CreateAccountsPayableDto>

export const UpdateAccountsPayableDto = z.object({
  description: z.string().trim().min(1).optional(),
  supplierName: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  amount: z.number().int().positive().optional(),
  dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().optional(),
})
export type UpdateAccountsPayableDto = z.infer<typeof UpdateAccountsPayableDto>

export const PayAccountsPayableDto = z.object({
  paymentMethod: z.enum(['cash', 'pix', 'card', 'transfer', 'boleto']),
  paidAt: z.string().datetime({ offset: true }).optional(),
})
export type PayAccountsPayableDto = z.infer<typeof PayAccountsPayableDto>
