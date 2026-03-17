import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ────────────────────────────────────────────────────────────────────

export interface PackageItem {
  serviceId: string
  quantity: number
  service: {
    id: string
    name: string
    category: string
    durationMinutes: number
  }
}

export interface ServicePackage {
  id: string
  name: string
  description: string | null
  price: number
  validityDays: number | null
  active: boolean
  items: PackageItem[]
  createdAt: string
  updatedAt: string
}

interface PackagesPage {
  items: ServicePackage[]
  total: number
  page: number
  limit: number
}

export interface CustomerPackageSession {
  id: string
  serviceId: string
  usedAt: string | null
  appointmentId: string | null
}

export interface CustomerPackage {
  id: string
  customerId: string
  packageId: string
  purchasedAt: string
  expiresAt: string | null
  package: ServicePackage
  sessions: CustomerPackageSession[]
}

export interface CreatePackageInput {
  name: string
  description?: string
  price: number
  validityDays?: number | null
  items: Array<{ serviceId: string; quantity: number }>
}

export interface UpdatePackageInput {
  name?: string
  description?: string
  price?: number
  validityDays?: number | null
  active?: boolean
}

// ──── Hooks ────────────────────────────────────────────────────────────────────

export function usePackages(params?: { active?: boolean; page?: number; limit?: number }) {
  return useQuery<PackagesPage>({
    queryKey: ['packages', params],
    queryFn: () => api.get('/packages', { params }).then((r) => r.data),
  })
}

export function usePackage(id: string) {
  return useQuery<ServicePackage>({
    queryKey: ['packages', id],
    queryFn: () => api.get(`/packages/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCustomerPackages(customerId: string) {
  return useQuery<CustomerPackage[]>({
    queryKey: ['customer-packages', customerId],
    queryFn: () => api.get(`/packages/customer/${customerId}`).then((r) => r.data),
    enabled: !!customerId,
  })
}

export function useCreatePackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePackageInput) =>
      api.post<ServicePackage>('/packages', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  })
}

export function useUpdatePackage(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdatePackageInput) =>
      api.patch<ServicePackage>(`/packages/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  })
}

export function usePurchasePackage(packageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (customerId: string) =>
      api.post<CustomerPackage>(`/packages/${packageId}/purchase`, { customerId }).then((r) => r.data),
    onSuccess: (_data, customerId) => {
      qc.invalidateQueries({ queryKey: ['customer-packages', customerId] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
}

export function useRedeemSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (appointmentId?: string) =>
      api
        .post(`/packages/sessions/${sessionId}/redeem`, appointmentId ? { appointmentId } : {})
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-packages'] }),
  })
}
