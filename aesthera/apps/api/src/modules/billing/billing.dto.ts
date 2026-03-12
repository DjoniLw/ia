import { z } from 'zod'

export const ListBillingQuery = z.object({
  customerId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListBillingQuery = z.infer<typeof ListBillingQuery>

export const CancelBillingDto = z.object({
  reason: z.string().optional(),
})
export type CancelBillingDto = z.infer<typeof CancelBillingDto>
