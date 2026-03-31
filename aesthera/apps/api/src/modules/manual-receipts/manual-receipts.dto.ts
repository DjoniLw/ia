import { z } from 'zod'

export const ManualReceiptLineDto = z.discriminatedUnion('paymentMethod', [
  z.object({ paymentMethod: z.literal('cash'), amount: z.number().int().positive() }),
  z.object({ paymentMethod: z.literal('pix'), amount: z.number().int().positive() }),
  z.object({ paymentMethod: z.literal('card'), amount: z.number().int().positive() }),
  z.object({ paymentMethod: z.literal('transfer'), amount: z.number().int().positive() }),
  z.object({ paymentMethod: z.literal('wallet_credit'), amount: z.number().int().positive(), walletEntryId: z.string().uuid() }),
  z.object({ paymentMethod: z.literal('wallet_voucher'), amount: z.number().int().positive(), walletEntryId: z.string().uuid() }),
])

export const OverpaymentHandlingDto = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cash_change') }),
  z.object({ type: z.literal('wallet_credit') }),
  z.object({ type: z.literal('wallet_voucher') }),
])
export type OverpaymentHandlingDto = z.infer<typeof OverpaymentHandlingDto>

export const CreateManualReceiptDto = z.object({
  receivedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().optional(),
  lines: z.array(ManualReceiptLineDto).min(1),
  overpaymentHandling: OverpaymentHandlingDto.optional(),
  promotionCode: z.string().optional(),
})
export type CreateManualReceiptDto = z.infer<typeof CreateManualReceiptDto>
