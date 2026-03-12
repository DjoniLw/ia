import { z } from 'zod'

export const ListNotificationLogsDto = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  type: z.enum(['email', 'webhook']).optional(),
  invoiceId: z.string().uuid().optional(),
})

export const RetryNotificationDto = z.object({
  id: z.string().uuid(),
})

export type ListNotificationLogsDto = z.infer<typeof ListNotificationLogsDto>
export type RetryNotificationDto = z.infer<typeof RetryNotificationDto>
