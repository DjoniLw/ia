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

export interface Billing {
  id: string
  amount: number
  status: BillingStatus
  paymentLink: string | null
  paymentToken: string
  dueDate: string
  paidAt: string | null
  overdueAt: string | null
  cancelledAt: string | null
  createdAt: string
  customer: AppointmentCustomer
  appointment: BillingAppointment
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
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

/** Available time slots for a service on a date (optionally filtered to one professional) */
export function useAvailableSlots(
  params: { serviceId: string; date: string; professionalId?: string } | null,
) {
  return useQuery<AvailableSlotsResult>({
    queryKey: ['appointments-available-slots', params],
    queryFn: () =>
      api.get('/appointments/available-slots', { params: params! }).then((r) => r.data),
    enabled: !!params?.serviceId && !!params?.date,
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
    }) => api.post('/appointments', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['appointments-calendar'] })
      qc.invalidateQueries({ queryKey: ['appointments-availability'] })
    },
  })
}

export function useAppointmentTransition(id: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] })
    qc.invalidateQueries({ queryKey: ['appointments-calendar'] })
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

export function useBilling(params?: Record<string, string>) {
  return useQuery<Paginated<Billing>>({
    queryKey: ['billing', params],
    queryFn: () => api.get('/billing', { params }).then((r) => r.data),
  })
}

export function useCancelBilling(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/billing/${id}/cancel`).then((r) => r.data),
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
