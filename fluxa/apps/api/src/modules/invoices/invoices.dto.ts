import { z } from 'zod'

export const CreateInvoiceDto = z.object({
  customerId: z.string().uuid(),
  amount: z.number().int().positive(),
  description: z.string().optional(),
  dueDate: z.coerce.date(),
  paymentMethods: z.array(z.enum(['pix', 'boleto', 'card'])).min(1),
  metadata: z.record(z.string(), z.any()).optional(),
  notify: z.boolean().default(true),
})

export const GeneratePaymentLinkDto = z.object({
  invoiceId: z.string().uuid(),
})

export const ListInvoicesDto = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z
    .enum(['draft', 'pending', 'paid', 'overdue', 'cancelled', 'expired'])
    .optional(),
  customerId: z.string().uuid().optional(),
  sort: z.enum(['dueDate', 'amount', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export const MarkAsPaidDto = z.object({
  paymentId: z.string().uuid(),
})

export const CancelInvoiceDto = z.object({
  reason: z.string().optional(),
})

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceDto>
export type GeneratePaymentLinkDto = z.infer<typeof GeneratePaymentLinkDto>
export type ListInvoicesDto = z.infer<typeof ListInvoicesDto>
export type MarkAsPaidDto = z.infer<typeof MarkAsPaidDto>
export type CancelInvoiceDto = z.infer<typeof CancelInvoiceDto>
