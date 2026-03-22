import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ───────────────────────────────────────────────────────────────────

export type LedgerEntryType = 'credit' | 'debit'

export interface LedgerEntry {
  id: string
  type: LedgerEntryType
  amount: number
  currency: string
  description: string | null
  createdAt: string
  payment: {
    id: string
    gateway: string
    method: string
    status: string
    gatewayPaymentId: string | null
  }
  billing: { id: string; amount: number } | null
  appointment: {
    id: string
    scheduledAt: string
    service: { id: string; name: string }
    professional: { id: string; name: string }
  } | null
  customer: { id: string; name: string; email: string | null } | null
}

export interface LedgerSummary {
  totalCredits: number
  totalDebits: number
  netBalance: number
  creditCount: number
  debitCount: number
}

interface LedgerPage {
  items: LedgerEntry[]
  total: number
  page: number
  limit: number
}

export type NotificationStatus = 'pending' | 'sent' | 'failed'
export type NotificationType = 'whatsapp' | 'email'

export interface NotificationLog {
  id: string
  type: NotificationType
  channel: string
  event: string
  status: NotificationStatus
  attempts: number
  lastAttemptAt: string | null
  error: string | null
  createdAt: string
  payload: Record<string, string>
  customer: { id: string; name: string; email: string | null; phone: string | null } | null
}

interface NotificationsPage {
  items: NotificationLog[]
  total: number
  page: number
  limit: number
}

// ──── Ledger hooks ─────────────────────────────────────────────────────────────

export function useLedger(params?: Record<string, string | number>) {
  return useQuery<LedgerPage>({
    queryKey: ['ledger', params],
    queryFn: () => api.get('/ledger', { params }).then((r) => r.data),
  })
}

export function useLedgerSummary(params?: { from?: string; to?: string }, options?: { enabled?: boolean }) {
  return useQuery<LedgerSummary>({
    queryKey: ['ledger-summary', params],
    queryFn: () => api.get('/ledger/summary', { params }).then((r) => r.data),
    ...options,
  })
}

export function useLedgerChart(params: { from: string; to: string }) {
  return useQuery<LedgerPage>({
    queryKey: ['ledger-chart', params],
    queryFn: () => api.get('/ledger', { params: { ...params, limit: 500 } }).then((r) => r.data),
  })
}

// ──── Notifications hooks ──────────────────────────────────────────────────────

export function useNotifications(params?: Record<string, string | number>) {
  return useQuery<NotificationsPage>({
    queryKey: ['notifications', params],
    queryFn: () => api.get('/notifications/logs', { params }).then((r) => r.data),
  })
}

export function useRetryNotification(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ queued: boolean }>(`/notifications/logs/${id}/retry`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

// ──── Appointments calendar for dashboard ─────────────────────────────────────

export interface AppointmentSummary {
  id: string
  scheduledAt: string
  durationMinutes: number
  status: string
  customer: { id: string; name: string }
  service: { id: string; name: string }
  professional: { id: string; name: string }
}

export function useTodayAppointments() {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)
  return useQuery<AppointmentSummary[]>({
    queryKey: ['appointments-today', dateStr],
    queryFn: () =>
      api
        .get<{ items: AppointmentSummary[] }>('/appointments', { params: { date: dateStr, limit: 100 } })
        .then((r) => r.data.items),
  })
}
