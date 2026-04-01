import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ────────────────────────────────────────────────────────────────────

export type DiscountType = 'PERCENTAGE' | 'FIXED'
export type PromotionStatus = 'active' | 'inactive' | 'expired'

export interface Promotion {
  id: string
  name: string
  code: string
  description: string | null
  discountType: DiscountType
  discountValue: number
  maxUses: number | null
  maxUsesPerCustomer: number | null
  usesCount: number
  minAmount: number | null
  applicableServiceIds: string[]
  applicableProductIds: string[]
  status: PromotionStatus
  validFrom: string
  validUntil: string | null
  createdAt: string
  updatedAt: string
}

interface PromotionsPage {
  items: Promotion[]
  total: number
  page: number
  limit: number
}

export interface CreatePromotionInput {
  name: string
  code: string
  description?: string
  discountType: DiscountType
  discountValue: number
  maxUses?: number | null
  maxUsesPerCustomer?: number | null
  minAmount?: number | null
  applicableServiceIds?: string[]
  applicableProductIds?: string[]
  validFrom: string
  validUntil?: string | null
}

export interface UpdatePromotionInput {
  name?: string
  description?: string
  status?: PromotionStatus
  maxUses?: number | null
  maxUsesPerCustomer?: number | null
  minAmount?: number | null
  validUntil?: string | null
  applicableServiceIds?: string[]
  applicableProductIds?: string[]
}

export interface ValidatePromotionResult {
  discountAmount: number
}

// ──── Hooks ────────────────────────────────────────────────────────────────────

export function usePromotions(params?: { status?: PromotionStatus; search?: string; page?: number; limit?: number }) {
  return useQuery<PromotionsPage>({
    queryKey: ['promotions', params],
    queryFn: () => api.get('/promotions', { params }).then((r) => r.data),
  })
}

export function usePromotion(id: string) {
  return useQuery<Promotion>({
    queryKey: ['promotions', id],
    queryFn: () => api.get(`/promotions/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePromotionInput) =>
      api.post<Promotion>('/promotions', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  })
}

export function useUpdatePromotion(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdatePromotionInput) =>
      api.patch<Promotion>(`/promotions/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  })
}

export function useValidatePromotion() {
  return useMutation({
    mutationFn: (dto: { code: string; billingAmount: number; serviceIds?: string[]; customerId?: string }) =>
      api.post<ValidatePromotionResult>('/promotions/validate', dto).then((r) => r.data),
  })
}

export function useTogglePromotion(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (active: boolean) =>
      api.patch<Promotion>(`/promotions/${id}/status`, { active }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions'] })
    },
  })
}

export function useActivePromotionsForService(serviceId: string, customerId?: string, enabled = true) {
  return useQuery<Promotion[]>({
    queryKey: ['promotions-for-service', serviceId, customerId],
    queryFn: () =>
      api
        .get(`/promotions/active-for-service/${serviceId}`, {
          params: customerId ? { customerId } : undefined,
        })
        .then((r) => r.data),
    enabled: !!serviceId && enabled,
    staleTime: 30_000,
  })
}

export function useActivePromotionsForProduct(productId: string, enabled = true) {
  return useQuery<Promotion[]>({
    queryKey: ['promotions-for-product', productId],
    queryFn: () =>
      api.get(`/promotions/active-for-product/${productId}`).then((r) => r.data),
    enabled: !!productId && enabled,
    staleTime: 30_000,
  })
}
