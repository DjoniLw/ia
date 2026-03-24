import { z } from 'zod'

export const ManualReceiptLineDto = z.object({
  paymentMethod: z.enum(['cash', 'pix', 'card', 'transfer', 'wallet_credit', 'wallet_voucher']),
  amount: z.number().int().positive(),
  walletEntryId: z.string().uuid().optional(),
})

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
})
export type CreateManualReceiptDto = z.infer<typeof CreateManualReceiptDto>
