import { z } from 'zod'

export const WalletEntryTypeEnum = z.enum(['VOUCHER', 'CREDIT', 'CASHBACK', 'PACKAGE'])
export const WalletEntryStatusEnum = z.enum(['ACTIVE', 'USED', 'EXPIRED'])
export const WalletOriginTypeEnum = z.enum([
  'OVERPAYMENT',
  'GIFT',
  'REFUND',
  'CASHBACK_PROMOTION',
  'PACKAGE_PURCHASE',
  'VOUCHER_SPLIT',
])

export const ListWalletQuery = z.object({
  customerId: z.string().uuid().optional(),
  type: WalletEntryTypeEnum.optional(),
  status: WalletEntryStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListWalletQuery = z.infer<typeof ListWalletQuery>

export const CreateWalletEntryDto = z.object({
  customerId: z.string().uuid(),
  type: WalletEntryTypeEnum.default('VOUCHER'),
  value: z.number().int().positive(),
  originType: WalletOriginTypeEnum.default('GIFT'),
  originReference: z.string().optional(),
  expirationDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
})
export type CreateWalletEntryDto = z.infer<typeof CreateWalletEntryDto>

export const AdjustWalletEntryDto = z.object({
  value: z.number().int(), // positive = add, negative = subtract
  notes: z.string().min(1),
})
export type AdjustWalletEntryDto = z.infer<typeof AdjustWalletEntryDto>

export const WalletSummaryQuery = z.object({
  customerId: z.string().uuid(),
})
export type WalletSummaryQuery = z.infer<typeof WalletSummaryQuery>
