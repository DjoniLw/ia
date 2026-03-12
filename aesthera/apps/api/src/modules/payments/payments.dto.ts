import { z } from 'zod'

export const ListPaymentsQuery = z.object({
  billingId: z.string().uuid().optional(),
  status: z.enum(['pending', 'paid', 'failed', 'expired', 'refunded', 'disputed']).optional(),
  gateway: z.enum(['stripe', 'mercadopago']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListPaymentsQuery = z.infer<typeof ListPaymentsQuery>
