import { z } from 'zod'

export const PackageItemDto = z.object({
  serviceId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
})
export type PackageItemDto = z.infer<typeof PackageItemDto>

export const CreatePackageDto = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().min(0),
  validityDays: z.number().int().positive().optional(),
  items: z.array(PackageItemDto).min(1),
})
export type CreatePackageDto = z.infer<typeof CreatePackageDto>

export const UpdatePackageDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().int().min(0).optional(),
  validityDays: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
})
export type UpdatePackageDto = z.infer<typeof UpdatePackageDto>

export const ListPackagesQuery = z.object({
  active: z.coerce.boolean().optional(),
  name: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListPackagesQuery = z.infer<typeof ListPackagesQuery>

export const ListCustomerPackagesQuery = z.object({
  status: z.enum(['ativo', 'expirado', 'esgotado']).optional(),
  packageName: z.string().optional(),
  purchasedFrom: z.string().optional(),
  purchasedUntil: z.string().optional(),
})
export type ListCustomerPackagesQuery = z.infer<typeof ListCustomerPackagesQuery>

export const ListSoldPackagesQuery = z.object({
  customerId: z.string().uuid().optional(),
  purchasedFrom: z.string().optional(),
  purchasedUntil: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListSoldPackagesQuery = z.infer<typeof ListSoldPackagesQuery>

export const PaymentLineDto = z.object({
  method: z.string().min(1),
  amount: z.number().int().positive(),
})
export type PaymentLineDto = z.infer<typeof PaymentLineDto>

export const PurchasePackageDto = z.object({
  customerId: z.string().uuid(),
  paymentMethods: z.array(PaymentLineDto).min(1),
  notes: z.string().optional(),
})
export type PurchasePackageDto = z.infer<typeof PurchasePackageDto>

export const RedeemSessionDto = z.object({
  appointmentId: z.string().uuid().optional(),
})
export type RedeemSessionDto = z.infer<typeof RedeemSessionDto>
