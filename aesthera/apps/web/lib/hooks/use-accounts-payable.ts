import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ───────────────────────────────────────────────────────────────────

export type AccountsPayableStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type AccountsPayablePaymentMethod = 'cash' | 'pix' | 'card' | 'transfer' | 'boleto'

export interface AccountsPayable {
  id: string
  clinicId: string
  description: string
  supplierName: string | null
  category: string | null
  amount: number
  dueDate: string
  status: AccountsPayableStatus
  paidAt: string | null
  paymentMethod: string | null
  notes: string | null
  originType: string | null
  originReference: string | null
  createdAt: string
  updatedAt: string
}

export interface AccountsPayableSummary {
  totalPending: number
  totalOverdue: number
  totalPaidThisMonth: number
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ──── Hooks ───────────────────────────────────────────────────────────────────

export function useAccountsPayable(params?: Record<string, string>) {
  return useQuery<Paginated<AccountsPayable>>({
    queryKey: ['accounts-payable', params],
    queryFn: () => api.get('/accounts-payable', { params }).then((r) => r.data),
  })
}

export function useAccountsPayableSummary() {
  return useQuery<AccountsPayableSummary>({
    queryKey: ['accounts-payable-summary'],
    queryFn: () => api.get('/accounts-payable/summary').then((r) => r.data),
  })
}

export function useCreateAccountsPayable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      description: string
      supplierName?: string
      category?: string
      amount: number
      dueDate: string
      notes?: string
    }) => api.post('/accounts-payable', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts-payable'] })
      qc.invalidateQueries({ queryKey: ['accounts-payable-summary'] })
    },
  })
}

export function usePayAccountsPayable(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { paymentMethod: AccountsPayablePaymentMethod; paidAt?: string }) =>
      api.post(`/accounts-payable/${id}/pay`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts-payable'] })
      qc.invalidateQueries({ queryKey: ['accounts-payable-summary'] })
    },
  })
}

export function useCancelAccountsPayable(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/accounts-payable/${id}/cancel`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts-payable'] })
      qc.invalidateQueries({ queryKey: ['accounts-payable-summary'] })
    },
  })
}
