import { z } from 'zod'

export const ListLedgerQuery = z.object({
  type: z.enum(['credit', 'debit']).optional(),
  customerId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  billingId: z.string().uuid().optional(),
  from: z.string().optional(), // ISO date
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type ListLedgerQuery = z.infer<typeof ListLedgerQuery>

export const LedgerSummaryQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  customerId: z.string().uuid().optional(),
})

export type LedgerSummaryQuery = z.infer<typeof LedgerSummaryQuery>
