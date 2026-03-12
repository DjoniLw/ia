import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Clinic {
  id: string
  slug: string
  name: string
  email: string
  document: string | null
  phone: string | null
  timezone: string
  plan: string
  status: string
  address: {
    street?: string
    city?: string
    state?: string
    zip?: string
  } | null
}

interface BusinessHour {
  id: string
  dayOfWeek: number
  openTime: string
  closeTime: string
  isOpen: boolean
}

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'staff'
  active: boolean
  lastLoginAt: string | null
  createdAt: string
}

export function useClinic() {
  return useQuery<Clinic>({
    queryKey: ['clinic', 'me'],
    queryFn: () => api.get('/clinics/me').then((r) => r.data),
  })
}

export function useUpdateClinic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Clinic>) => api.patch('/clinics/me', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clinic', 'me'] }),
  })
}

export function useBusinessHours() {
  return useQuery<BusinessHour[]>({
    queryKey: ['clinic', 'business-hours'],
    queryFn: () => api.get('/clinics/me/business-hours').then((r) => r.data),
  })
}

export function useSetBusinessHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hours: Omit<BusinessHour, 'id'>[]) =>
      api.put('/clinics/me/business-hours', { hours }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clinic', 'business-hours'] }),
  })
}

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  })
}

export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; role: 'admin' | 'staff' }) =>
      api.post('/users/invite', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}
