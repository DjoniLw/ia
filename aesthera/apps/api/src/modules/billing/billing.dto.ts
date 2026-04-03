import { z } from 'zod'

export const ListBillingQuery = z.object({
  customerId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  customerName: z.string().trim().min(1).optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  sourceType: z.enum(['APPOINTMENT', 'PACKAGE_SALE', 'PRODUCT_SALE', 'MANUAL', 'PRESALE']).optional(),
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

export const ReceivePaymentDto = z.object({
  method: z.enum(['cash', 'pix', 'card', 'voucher']),
  receivedAmount: z.number().int().positive(),
  voucherId: z.string().uuid().optional(),
  promotionCode: z.string().optional(),
  notes: z.string().optional(),
})
export type ReceivePaymentDto = z.infer<typeof ReceivePaymentDto>

// SEC08 — sourceType restrito no POST /billing: não aceitar PACKAGE_SALE nem PRODUCT_SALE
export const CreateBillingDto = z.object({
  customerId: z.string().uuid(),
  sourceType: z.enum(['PRESALE', 'MANUAL', 'APPOINTMENT']),
  amount: z.number().int().positive(), // SEC06 — amount > 0
  serviceId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  notes: z.string().optional(),
  lockedPromotionCode: z.string().optional(),
  originalAmount: z.number().int().positive().optional(),
})
export type CreateBillingDto = z.infer<typeof CreateBillingDto>
