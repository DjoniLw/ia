import { z } from 'zod'

export const CreateProductDto = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  price: z.number().int().min(0),
  costPrice: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  unit: z.string().default('un'),
  imageUrl: z.string().url().optional().nullable(),
})
export type CreateProductDto = z.infer<typeof CreateProductDto>

export const UpdateProductDto = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  price: z.number().int().min(0).optional(),
  costPrice: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  unit: z.string().optional(),
  active: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
})
export type UpdateProductDto = z.infer<typeof UpdateProductDto>

export const ListProductsQuery = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  active: z.coerce.boolean().optional(),
  lowStock: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListProductsQuery = z.infer<typeof ListProductsQuery>

export const CreateSaleDto = z.object({
  productId: z.string().uuid(),
  customerId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().min(0).optional(), // override price if needed
  discount: z.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
})
export type CreateSaleDto = z.infer<typeof CreateSaleDto>

export const ListSalesQuery = z.object({
  productId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListSalesQuery = z.infer<typeof ListSalesQuery>
