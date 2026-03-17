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
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListPackagesQuery = z.infer<typeof ListPackagesQuery>

export const PurchasePackageDto = z.object({
  customerId: z.string().uuid(),
})
export type PurchasePackageDto = z.infer<typeof PurchasePackageDto>

export const RedeemSessionDto = z.object({
  appointmentId: z.string().uuid().optional(),
})
export type RedeemSessionDto = z.infer<typeof RedeemSessionDto>
