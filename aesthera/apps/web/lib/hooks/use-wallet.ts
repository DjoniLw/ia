import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ───────────────────────────────────────────────────────────────────

export type WalletEntryType = 'VOUCHER' | 'CREDIT' | 'CASHBACK' | 'PACKAGE'
export type WalletEntryStatus = 'ACTIVE' | 'USED' | 'EXPIRED'
export type WalletOriginType =
  | 'OVERPAYMENT'
  | 'GIFT'
  | 'REFUND'
  | 'CASHBACK_PROMOTION'
  | 'PACKAGE_PURCHASE'
  | 'VOUCHER_SPLIT'
  | 'SERVICE_PRESALE'
export type WalletTransactionType = 'CREATE' | 'USE' | 'SPLIT' | 'ADJUST' | 'REFUND'

export interface WalletTransaction {
  id: string
  walletEntryId: string
  type: WalletTransactionType
  value: number
  reference: string | null
  description: string | null
  createdAt: string
}

export interface WalletCustomer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export interface WalletEntry {
  id: string
  type: WalletEntryType
  originalValue: number
  balance: number
  code: string
  customerId: string
  originType: WalletOriginType
  originReference: string | null
  notes: string | null
  expirationDate: string | null
  status: WalletEntryStatus
  createdAt: string
  updatedAt: string
  customer: WalletCustomer
  transactions: WalletTransaction[]
  billingPaymentLines?: Array<{ paymentMethod: string; amount: number }>
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ──── Hooks ───────────────────────────────────────────────────────────────────

export function useWallet(params?: Record<string, string>, enabled = true) {
  return useQuery<Paginated<WalletEntry>>({
    queryKey: ['wallet', params],
    queryFn: () => api.get('/wallet', { params }).then((r) => r.data),
    enabled,
  })
}

export function useWalletOverview(params?: Record<string, string>, enabled = true) {
  return useQuery<Paginated<WalletEntry>>({
    queryKey: ['wallet', 'overview', params],
    queryFn: () => api.get('/wallet', { params }).then((r) => r.data),
    enabled,
  })
}

export function useActiveVouchers(customerId: string, enabled: boolean) {
  return useQuery<Paginated<WalletEntry>>({
    queryKey: ['wallet', { customerId, status: 'ACTIVE' }],
    queryFn: () =>
      api
        .get('/wallet', { params: { customerId, status: 'ACTIVE', limit: '50' } })
        .then((r) => r.data),
    enabled,
  })
}

export function useWalletEntry(id: string) {
  return useQuery<WalletEntry>({
    queryKey: ['wallet', id],
    queryFn: () => api.get(`/wallet/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateWalletEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      customerId: string
      type?: WalletEntryType
      value: number
      originType?: WalletOriginType
      originReference?: string
      expirationDate?: string
      notes?: string
    }) => api.post('/wallet', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
  })
}

export function useAdjustWalletEntry(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { value: number; notes: string }) =>
      api.patch(`/wallet/${id}/adjust`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
  })
}

export function useWalletSummary(customerId: string, enabled = true) {
  return useQuery<{ totalBalance: number }>({
    queryKey: ['wallet', 'summary', customerId],
    queryFn: () => api.get('/wallet/summary', { params: { customerId } }).then((r) => r.data),
    enabled: enabled && !!customerId,
  })
}

export function useCustomerWallet(
  customerId: string,
  status?: string,
  page = 1,
  enabled = true,
) {
  const entries = useQuery<Paginated<WalletEntry>>({
    queryKey: ['wallet', { customerId, status, page }],
    queryFn: () =>
      api
        .get('/wallet', {
          params: {
            customerId,
            ...(status ? { status } : {}),
            page: String(page),
            limit: '10',
          },
        })
        .then((r) => r.data),
    enabled: enabled && !!customerId,
  })

  const summary = useWalletSummary(customerId, enabled && !!customerId)

  return { entries, summary }
}

export function useReceivePayment(billingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      method: 'cash' | 'pix' | 'card' | 'voucher'
      receivedAmount: number
      voucherId?: string
      notes?: string
    }) => api.post(`/billing/${billingId}/receive-payment`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
}

export interface ServiceVoucher {
  id: string
  serviceId: string | null
  balance: number
  expirationDate: string | null
  code: string
  service: { id: string; name: string } | null
}

export function useServiceVouchers(customerId: string, serviceId?: string, enabled = true) {
  return useQuery<ServiceVoucher[]>({
    queryKey: ['wallet', 'service-vouchers', customerId, serviceId],
    queryFn: () =>
      api
        .get(`/wallet/service-vouchers/${customerId}`, {
          params: serviceId ? { serviceId } : undefined,
        })
        .then((r) => r.data),
    enabled: enabled && !!customerId,
  })
}
