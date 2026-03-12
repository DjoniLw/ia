import { z } from 'zod'

export const ListNotificationsQuery = z.object({
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  channel: z.enum(['whatsapp', 'email']).optional(),
  event: z.string().optional(),
  customerId: z.string().uuid().optional(),
  billingId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuery>
