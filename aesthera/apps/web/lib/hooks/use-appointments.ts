import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ───────────────────────────────────────────────────────────────────

export interface AppointmentCustomer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export interface AppointmentProfessional {
  id: string
  name: string
  speciality: string | null
}

export interface AppointmentService {
  id: string
  name: string
  category: string | null
  durationMinutes: number
}

export type AppointmentStatus =
  | 'draft'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export interface Appointment {
  id: string
  status: AppointmentStatus
  scheduledAt: string
  durationMinutes: number
  price: number
  notes: string | null
  cancellationReason: string | null
  completedAt: string | null
  cancelledAt: string | null
  customer: AppointmentCustomer
  professional: AppointmentProfessional
  service: AppointmentService
  createdAt: string
}

export interface AvailabilityResult {
  date: string
  slots: string[]
}

export interface CalendarSlot {
  type: 'appointment' | 'blocked'
  id: string
  start?: string
  startTime?: string
  endTime?: string
  duration?: number
  status?: AppointmentStatus
  customer?: string
  customerId?: string
  professional?: { id: string; name: string }
  room?: { id: string; name: string } | null
  service?: string
  price?: number
  notes?: string | null
  reason?: string | null
  recurrence?: string
  date?: string
  equipment?: Array<{ id: string; name: string }>
}

export interface CalendarProfessional {
  id: string
  name: string
  slots: CalendarSlot[]
}

export interface CalendarResult {
  date: string
  view: 'day' | 'week'
  professionals: CalendarProfessional[]
}

export interface BillingAppointment {
  id: string
  scheduledAt: string
  durationMinutes: number
  service: { id: string; name: string }
  professional: { id: string; name: string }
}

export type BillingStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export type BillingSourceType = 'APPOINTMENT' | 'PRESALE' | 'MANUAL' | 'PACKAGE_SALE' | 'PRODUCT_SALE' | 'WALLET_PURCHASE'

export interface Billing {
  id: string
  amount: number
  status: BillingStatus
  sourceType: BillingSourceType
  paymentLink: string | null
  paymentToken?: string
  dueDate: string
  paidAt: string | null
  overdueAt: string | null
  cancelledAt: string | null
  createdAt: string
  lockedPromotionCode?: string | null
  originalAmount?: number | null
  serviceId?: string | null
  service?: { id: string; name: string } | null
  customer: AppointmentCustomer
  appointment: BillingAppointment | null
  billingEvents?: Array<{
    id: string
    event: string
    fromStatus: string | null
    toStatus: string | null
    notes: string | null
    createdAt: string
  }>
  manualReceipt?: {
    id: string
    totalPaid: number
    receivedAt: string
    notes?: string | null
    lines: Array<{
      id: string
      paymentMethod: string
      amount: number
      walletEntryId?: string | null
      walletEntry?: { id: string; code: string; originType: string } | null
    }>
  } | null
}

export interface CompleteResult {
  appointment: Appointment
  billing: Billing | null
  serviceVouchers: Array<{
    id: string
    serviceId: string | null
    balance: number
    expirationDate: string | null
    code: string
    service: { id: string; name: string } | null
  }>
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalAmount?: number
  totalCashReceived?: number
  paymentMethodBreakdown?: Array<{ paymentMethod: string; total: number }>
}

// ──── Appointments ────────────────────────────────────────────────────────────

export function useAppointments(params?: Record<string, string>) {
  return useQuery<Paginated<Appointment>>({
    queryKey: ['appointments', params],
    queryFn: () => api.get('/appointments', { params }).then((r) => r.data),
  })
}

export function useCalendar(params: { date: string; view?: string; professionalId?: string }) {
  return useQuery<CalendarResult>({
    queryKey: ['appointments-calendar', params],
    queryFn: () => api.get('/appointments/calendar', { params }).then((r) => r.data),
  })
}

export function useAvailability(
  params: { professionalId: string; serviceId: string; date: string } | null,
) {
  return useQuery<AvailabilityResult>({
    queryKey: ['appointments-availability', params],
    queryFn: () => api.get('/appointments/availability', { params: params! }).then((r) => r.data),
    enabled: !!params?.professionalId && !!params?.serviceId && !!params?.date,
  })
}

export interface AvailableProfessional {
  id: string
  name: string
  speciality: string | null
  available: boolean
}

export interface AvailableSlotsResult {
  date: string
  slots: string[]
  professionals: { id: string; name: string; slots: string[] }[]
}

/** Available time slots for a service on a date (optionally filtered to one professional, one or more equipment items, or room) */
export function useAvailableSlots(
  params: { serviceId: string; date: string; professionalId?: string; equipmentId?: string; roomId?: string } | null,
) {
  return useQuery<AvailableSlotsResult>({
    queryKey: ['appointments-available-slots', params],
    queryFn: () => {
      const { equipmentId, ...rest } = params!
      // The backend accepts equipmentId as a comma-separated string of UUIDs
      const queryParams: Record<string, string | undefined> = { ...rest }
      if (equipmentId) queryParams.equipmentId = equipmentId
      return api.get('/appointments/available-slots', { params: queryParams }).then((r) => r.data)
    },
    enabled: !!params?.serviceId && !!params?.date,
    staleTime: 0,
  })
}

/** Professionals that can perform a service on a date, optionally filtered to a specific time */
export function useAvailableProfessionals(
  params: { serviceId: string; date: string; time?: string } | null,
) {
  return useQuery<{ professionals: AvailableProfessional[] }>({
    queryKey: ['appointments-available-professionals', params],
    queryFn: () =>
      api.get('/appointments/available-professionals', { params: params! }).then((r) => r.data),
    enabled: !!params?.serviceId && !!params?.date,
    staleTime: 0,
  })
}

export interface AvailableRoom {
  id: string
  name: string
  description: string | null
  active: boolean
  available: boolean
}

/** Active rooms annotated with availability for a given time slot */
export function useAvailableRooms(
  params: { scheduledAt: string; durationMinutes: number; excludeAppointmentId?: string } | null,
) {
  return useQuery<AvailableRoom[]>({
    queryKey: ['appointments-available-rooms', params],
    queryFn: () =>
      api.get('/appointments/available-rooms', { params: params! }).then((r) => r.data),
    enabled: !!params?.scheduledAt && !!params?.durationMinutes,
    staleTime: 0,
  })
}

export function useCreateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      customerId: string
      professionalId: string
      serviceId: string
      scheduledAt: string
      notes?: string
      equipmentIds?: string[]
      packageSessionId?: string
      roomId?: string
    }) => api.post('/appointments', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['appointments-calendar'] })
      qc.invalidateQueries({ queryKey: ['appointments-availability'] })
      qc.invalidateQueries({ queryKey: ['appointments-available-slots'] })
      qc.invalidateQueries({ queryKey: ['appointments-available-professionals'] })
      qc.invalidateQueries({ queryKey: ['appointments-available-rooms'] })
      qc.invalidateQueries({ queryKey: ['available-equipment'] })
    },
  })
}

export function useAppointmentTransition(id: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] })
    qc.invalidateQueries({ queryKey: ['appointments-calendar'] })
    qc.invalidateQueries({ queryKey: ['appointments-available-slots'] })
    qc.invalidateQueries({ queryKey: ['appointments-available-professionals'] })
    qc.invalidateQueries({ queryKey: ['appointments-available-rooms'] })
    qc.invalidateQueries({ queryKey: ['available-equipment'] })
  }
  return {
    confirm: useMutation({
      mutationFn: () => api.post(`/appointments/${id}/confirm`).then((r) => r.data),
      onSuccess: invalidate,
    }),
    start: useMutation({
      mutationFn: () => api.post(`/appointments/${id}/start`).then((r) => r.data),
      onSuccess: invalidate,
    }),
    complete: useMutation({
      mutationFn: () => api.post(`/appointments/${id}/complete`).then((r) => r.data),
      onSuccess: () => {
        invalidate()
        qc.invalidateQueries({ queryKey: ['billing'] })
        qc.invalidateQueries({ queryKey: ['wallet'] })
      },
    }),
    cancel: useMutation({
      mutationFn: (reason?: string) =>
        api.post(`/appointments/${id}/cancel`, { cancellationReason: reason }).then((r) => r.data),
      onSuccess: invalidate,
    }),
    noShow: useMutation({
      mutationFn: () => api.post(`/appointments/${id}/no-show`).then((r) => r.data),
      onSuccess: invalidate,
    }),
  }
}

// ──── Billing ─────────────────────────────────────────────────────────────────

export function useBilling(params?: Record<string, string>, options?: { enabled?: boolean }) {
  return useQuery<Paginated<Billing>>({
    queryKey: ['billing', params],
    queryFn: () => api.get('/billing', { params }).then((r) => r.data),
    ...options,
  })
}

export function useOneBilling(id: string | null) {
  return useQuery<Billing>({
    queryKey: ['billing', id],
    queryFn: () => api.get(`/billing/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCancelBilling(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) =>
      api.post(`/billing/${id}/cancel`, reason ? { reason } : {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
}

export function useReopenBilling(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notes?: string) => api.post(`/billing/${id}/reopen`, { notes }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  })
}

export function useMarkBillingPaid(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/billing/${id}/mark-paid`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  })
}

// ──── Manual Receipts (Recebimento Manual) ────────────────────────────────────

export type ManualReceiptPaymentMethod =
  | 'cash'
  | 'pix'
  | 'card'
  | 'transfer'
  | 'wallet_credit'
  | 'wallet_voucher'

export interface ManualReceiptLine {
  paymentMethod: ManualReceiptPaymentMethod
  amount: number
  walletEntryId?: string
}

export type OverpaymentHandlingType = 'cash_change' | 'wallet_credit' | 'wallet_voucher'

export interface CreateManualReceiptPayload {
  receivedAt?: string
  notes?: string
  lines: ManualReceiptLine[]
  overpaymentHandling?: { type: OverpaymentHandlingType }
  promotionCode?: string
}

export interface ManualReceiptResult {
  receipt: {
    id: string
    billingId: string
    totalPaid: number
    receivedAt: string
    notes: string | null
    lines: Array<{
      id: string
      paymentMethod: string
      amount: number
      walletEntryId: string | null
    }>
  }
  walletEntry: { code: string; balance: number } | null
}

export function useCreateManualReceipt(billingId: string) {
  const qc = useQueryClient()
  return useMutation<ManualReceiptResult, Error, CreateManualReceiptPayload>({
    mutationFn: (data) => api.post(`/billing/${billingId}/receive`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      // Força re-fetch das promoções disponíveis — usesCount pode ter mudado após aplicação
      qc.invalidateQueries({ queryKey: ['promotions-for-service'] })
    },
  })
}

export interface CreateBillingPayload {
  customerId: string
  sourceType: BillingSourceType
  amount: number
  serviceId?: string
  appointmentId?: string
  dueDate?: string
  notes?: string
}

export function useCreateBilling() {
  const qc = useQueryClient()
  return useMutation<Billing, Error, CreateBillingPayload>({
    mutationFn: (data) => api.post('/billing', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] })
      qc.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
