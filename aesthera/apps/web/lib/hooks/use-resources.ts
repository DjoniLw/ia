import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Service {
  id: string
  name: string
  description: string | null
  category: string | null
  durationMinutes: number
  price: number
  active: boolean
  createdAt: string
}

export interface Professional {
  id: string
  name: string
  email: string
  phone: string | null
  speciality: string | null
  active: boolean
  createdAt: string
  services?: Array<{ service: Service }>
  workingHours?: WorkingHour[]
}

export interface WorkingHour {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  birthDate: string | null
  notes: string | null
  createdAt: string
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ──── Services ────────────────────────────────────────────────────────────────

export function useServices(params?: Record<string, string>) {
  return useQuery<Paginated<Service>>({
    queryKey: ['services', params],
    queryFn: () => api.get('/services', { params }).then((r) => r.data),
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Service, 'id' | 'active' | 'createdAt'>) =>
      api.post('/services', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useUpdateService(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Service>) => api.patch(`/services/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

// ──── Professionals ───────────────────────────────────────────────────────────

export function useProfessionals(params?: Record<string, string>) {
  return useQuery<Paginated<Professional>>({
    queryKey: ['professionals', params],
    queryFn: () => api.get('/professionals', { params }).then((r) => r.data),
  })
}

export function useCreateProfessional() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Pick<Professional, 'name' | 'email' | 'phone' | 'speciality'>) =>
      api.post('/professionals', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  })
}

export function useUpdateProfessional(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Professional>) =>
      api.patch(`/professionals/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  })
}

export function useDeleteProfessional() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/professionals/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  })
}

export function useAssignServices(professionalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (serviceIds: string[]) =>
      api.put(`/professionals/${professionalId}/services`, { serviceIds }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  })
}

// ──── Customers ───────────────────────────────────────────────────────────────

export function useCustomers(params?: Record<string, string>) {
  return useQuery<Paginated<Customer>>({
    queryKey: ['customers', params],
    queryFn: () => api.get('/customers', { params }).then((r) => r.data),
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Customer, 'id' | 'createdAt'>) =>
      api.post('/customers', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Customer>) =>
      api.patch(`/customers/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}
