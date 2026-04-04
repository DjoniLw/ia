import { z } from 'zod'

export const WalletEntryTypeEnum = z.enum(['VOUCHER', 'CREDIT', 'CASHBACK', 'PACKAGE'])
export const WalletEntryStatusEnum = z.enum(['PENDING', 'ACTIVE', 'USED', 'EXPIRED'])
export const WalletOriginTypeEnum = z.enum([
  'OVERPAYMENT',
  'GIFT',
  'REFUND',
  'CASHBACK_PROMOTION',
  'PACKAGE_PURCHASE',
  'VOUCHER_SPLIT',
  'SERVICE_PRESALE',
])

export const ListWalletQuery = z.object({
  customerId: z.string().uuid().optional(),
  type: WalletEntryTypeEnum.optional(),
  status: WalletEntryStatusEnum.optional(),
  createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)), { message: 'Data inválida' }).optional(),
  createdAtTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)), { message: 'Data inválida' }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListWalletQuery = z.infer<typeof ListWalletQuery>

// Origin types disponíveis para criação manual (excluindo os gerados pelo sistema)
export const ManualOriginTypeEnum = z.enum([
  'GIFT',
  'REFUND',
  'CASHBACK_PROMOTION',
])

export const CreateWalletEntryDto = z.object({
  customerId: z.string().uuid(),
  type: WalletEntryTypeEnum.exclude(['PACKAGE']).default('VOUCHER'),
  value: z.number().int().positive(),
  originType: ManualOriginTypeEnum.default('GIFT'),
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
