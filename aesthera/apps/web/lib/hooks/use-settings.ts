import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AnamnesisQuestionOption {
  label: string
  withDescription?: boolean
}

export interface AnamnesisQuestion {
  id: string
  text: string
  type: 'text' | 'yesno' | 'multiple' | 'numeric' | 'date' | 'select'
  options?: string[]               // for 'multiple' type
  selectOptions?: AnamnesisQuestionOption[]  // for 'select' type
  required: boolean
}

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
  settings?: {
    anamnesisQuestions?: AnamnesisQuestion[]
    [key: string]: unknown
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

export function useAnamnesisTemplate() {
  return useQuery<AnamnesisQuestion[]>({
    queryKey: ['clinic', 'anamnesis-template'],
    queryFn: () =>
      api
        .get('/clinics/me')
        .then((r) => (r.data.settings?.anamnesisQuestions as AnamnesisQuestion[]) ?? DEFAULT_ANAMNESIS_QUESTIONS),
  })
}

const DEFAULT_ANAMNESIS_QUESTIONS: AnamnesisQuestion[] = [
  { id: 'q1', text: 'Tipo de pele (seca, oleosa, mista, sensível)', type: 'text', required: false },
  { id: 'q2', text: 'Possui alergias conhecidas?', type: 'yesno', required: true },
  { id: 'q3', text: 'Quais alergias? (descreva)', type: 'text', required: false },
  { id: 'q4', text: 'Faz uso de medicamentos?', type: 'yesno', required: true },
  { id: 'q5', text: 'Quais medicamentos? (descreva)', type: 'text', required: false },
  { id: 'q6', text: 'Tem histórico de doenças de pele?', type: 'yesno', required: false },
  { id: 'q7', text: 'Já realizou tratamentos estéticos anteriormente?', type: 'yesno', required: false },
  { id: 'q8', text: 'Está grávida ou amamentando?', type: 'yesno', required: false },
]

export { DEFAULT_ANAMNESIS_QUESTIONS }

export function useSaveAnamnesisTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (questions: AnamnesisQuestion[]) =>
      api.patch('/clinics/me', { settings: { anamnesisQuestions: questions } }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic'] })
    },
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
