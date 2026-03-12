import { z } from 'zod'

export const CreatePaymentIntentDto = z.object({
  invoiceId: z.string().uuid(),
  method: z.enum(['pix', 'boleto', 'card']),
})

export const ListPaymentsDto = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z
    .enum(['pending', 'paid', 'failed', 'expired', 'refunded', 'disputed'])
    .optional(),
  invoiceId: z.string().uuid().optional(),
  gateway: z.enum(['stripe', 'mercadopago']).optional(),
})

export const StripeWebhookDto = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
      status: z.string(),
      metadata: z.record(z.string(), z.any()).optional(),
    }),
  }),
})

export const MercadoPagoWebhookDto = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    id: z.coerce.string(),
    status: z.string(),
    external_reference: z.string().optional(),
  }),
})

export type CreatePaymentIntentDto = z.infer<typeof CreatePaymentIntentDto>
export type ListPaymentsDto = z.infer<typeof ListPaymentsDto>
export type StripeWebhookDto = z.infer<typeof StripeWebhookDto>
export type MercadoPagoWebhookDto = z.infer<typeof MercadoPagoWebhookDto>
