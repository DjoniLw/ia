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

export type PackageSessionStatus = 'ABERTO' | 'AGENDADO' | 'FINALIZADO' | 'EXPIRADO'

export interface CustomerPackageSession {
  id: string
  serviceId: string
  status: PackageSessionStatus
  usedAt: string | null
  appointmentId: string | null
}

export interface CustomerPackagesQuery {
  status?: 'ativo' | 'expirado' | 'esgotado'
  packageName?: string
  purchasedFrom?: string
  purchasedUntil?: string
}

export interface SoldPackage {
  id: string
  customerId: string
  packageId: string
  purchasedAt: string
  expiresAt: string | null
  billingId: string | null
  package: ServicePackage
  customer: { id: string; name: string; email: string }
  sessions: CustomerPackageSession[]
}

interface SoldPackagesPage {
  items: SoldPackage[]
  total: number
  page: number
  limit: number
}

export interface PurchasePackageInput {
  customerId: string
  paymentMethods: Array<{ method: string; amount: number }>
  notes?: string
}

export interface AvailableSessionEntry {
  session: CustomerPackageSession
  packageName: string
  customerPackageId: string
  expiresAt: string | null
  /** 1-based index of this session within all sessions for the same service in this package */
  sessionNumber: number
  /** Total sessions for this service in this package */
  totalSessions: number
  serviceName: string
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

export interface PurchasePackageResult {
  customerPackageId: string | undefined
  billingId: string
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

export function usePackages(params?: { active?: boolean; name?: string; page?: number; limit?: number }) {
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

export function useCustomerPackages(customerId: string, query?: CustomerPackagesQuery) {
  return useQuery<CustomerPackage[]>({
    queryKey: ['customer-packages', customerId, query],
    queryFn: () => api.get(`/packages/customer/${customerId}`, { params: query }).then((r) => r.data),
    enabled: !!customerId,
  })
}

export function useSoldPackages(params?: { page?: number; limit?: number; customerId?: string }) {
  return useQuery<SoldPackagesPage>({
    queryKey: ['sold-packages', params],
    queryFn: () => api.get('/packages/sold', { params }).then((r) => r.data),
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
    mutationFn: ({ dto, idempotencyKey }: { dto: PurchasePackageInput; idempotencyKey: string }) =>
      api
        .post<PurchasePackageResult>(`/packages/${packageId}/purchase`, dto, {
          headers: { 'Idempotency-Key': idempotencyKey },
        })
        .then((r) => r.data),
    onSuccess: (_data, { dto }) => {
      qc.invalidateQueries({ queryKey: ['customer-packages', dto.customerId] })
      qc.invalidateQueries({ queryKey: ['sold-packages'] })
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

/**
 * Returns available (not yet used AND not linked to another appointment) sessions
 * for a specific customer + service combination.
 * Derived from /packages/customer/:customerId — no extra API call needed.
 */
export function useAvailableSessionsForService(customerId: string, serviceId: string, appointmentId?: string | null) {
  return useQuery<AvailableSessionEntry[]>({
    queryKey: ['customer-package-sessions', customerId, serviceId, appointmentId ?? null],
    queryFn: async () => {
      const packages: CustomerPackage[] = await api
        .get(`/packages/customer/${customerId}`)
        .then((r) => r.data)

      const result: AvailableSessionEntry[] = []

      for (const cp of packages) {
        const isExpired = cp.expiresAt && new Date(cp.expiresAt) < new Date()
        if (isExpired) continue

        // All sessions for this service in this package (used, reserved, and free)
        const allForService = cp.sessions.filter((s) => s.serviceId === serviceId)
        const totalSessions = allForService.length
        if (totalSessions === 0) continue

        // Determine service name from the package items
        const serviceItem = cp.package.items.find((i) => i.serviceId === serviceId)
        const serviceName = serviceItem?.service.name ?? ''

        // Sort by id (UUID) para garantir ordem estável antes/depois do pagamento
        // usedAt muda ao pagar — usar id como chave de ordenação consistente
        const stableForService = [...allForService].sort((a, b) => a.id.localeCompare(b.id))
        const totalByIdOrder = stableForService.length

        // Number all sessions 1..N in stable order
        stableForService.forEach((session, idx) => {
          const isAberto = session.status === 'ABERTO'
          // Incluir também sessões AGENDADO vinculadas ao agendamento desta cobrança
          const isAgendadoForThisAppt =
            session.status === 'AGENDADO' &&
            appointmentId &&
            (session as { appointmentId?: string | null }).appointmentId === appointmentId
          if (isAberto || isAgendadoForThisAppt) {
            result.push({
              session,
              packageName: cp.package.name,
              customerPackageId: cp.id,
              expiresAt: cp.expiresAt,
              sessionNumber: idx + 1,
              totalSessions: totalByIdOrder,
              serviceName,
            })
          }
        })
      }
      // Sessões AGENDADO para este agendamento têm prioridade — aparecem antes das ABERTO
      result.sort((a, b) => {
        const aReserved = a.session.status === 'AGENDADO' ? 0 : 1
        const bReserved = b.session.status === 'AGENDADO' ? 0 : 1
        return aReserved - bReserved
      })
      return result
    },
    enabled: !!customerId && !!serviceId,
  })
}

export function useReserveSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (appointmentId: string) =>
      api.post(`/packages/sessions/${sessionId}/reserve`, { appointmentId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-packages'] })
      qc.invalidateQueries({ queryKey: ['customer-package-sessions'] })
    },
  })
}

export function useReleaseSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post(`/packages/sessions/${sessionId}/release`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-packages'] })
      qc.invalidateQueries({ queryKey: ['customer-package-sessions'] })
    },
  })
}

export function usePayWithPackage(billingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (packageSessionId: string) =>
      api.post(`/billing/${billingId}/pay-with-package`, { packageSessionId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] })
      qc.invalidateQueries({ queryKey: ['customer-packages'] })
      qc.invalidateQueries({ queryKey: ['customer-package-sessions'] })
    },
  })
}
