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

export interface CustomerAddress {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export interface CustomerAnamnesis {
  skinType?: string
  allergies?: string
  medications?: string
  conditions?: string
  previousTreatments?: string
  currentTreatments?: string
  observations?: string
  consentSigned?: boolean
  consentDate?: string
}

export interface CustomerMeta {
  phone2?: string | null
  rg?: string | null
  gender?: string | null
  occupation?: string | null
  howFound?: string | null
  anamnesis?: CustomerAnamnesis | null
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  birthDate: string | null
  notes: string | null
  address: CustomerAddress | null
  metadata: CustomerMeta | null
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
    mutationFn: (data: { name: string; description: string | null; category: string | null; durationMinutes: number; price: number }) =>
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}

export function useGetCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then((r) => r.data),
    enabled: !!id,
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

// ──── Products ────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  name: string
  description: string | null
  category: string | null
  brand: string | null
  sku: string | null
  barcode: string | null
  price: number
  costPrice: number | null
  stock: number
  minStock: number
  unit: string
  active: boolean
  imageUrl: string | null
  createdAt: string
}

export interface ProductSale {
  id: string
  quantity: number
  unitPrice: number
  totalPrice: number
  discount: number
  paymentMethod: string | null
  notes: string | null
  soldAt: string
  product: { id: string; name: string; unit: string }
  customer: { id: string; name: string } | null
}

export function useProducts(params?: Record<string, string>) {
  return useQuery<Paginated<Product>>({
    queryKey: ['products', params],
    queryFn: () => api.get('/products', { params }).then((r) => r.data),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Product, 'id' | 'createdAt' | 'active'>) =>
      api.post('/products', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Product>) => api.patch(`/products/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useSellProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { productId: string; customerId?: string | null; quantity: number; discount?: number; paymentMethod?: string | null; notes?: string | null }) =>
      api.post('/products/sell', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product-sales'] })
    },
  })
}

export function useProductSales(params?: Record<string, string>) {
  return useQuery<Paginated<ProductSale>>({
    queryKey: ['product-sales', params],
    queryFn: () => api.get('/products/sales', { params }).then((r) => r.data),
  })
}

// ──── Birthdays ───────────────────────────────────────────────────────────────

export interface BirthdayCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  birthDate: string | null
  age: number
  isToday: boolean
}

export function useCustomerBirthdays(days = 7) {
  return useQuery<{ items: BirthdayCustomer[]; total: number }>({
    queryKey: ['customer-birthdays', days],
    queryFn: () => api.get('/customers/birthdays', { params: { days } }).then((r) => r.data),
  })
}

// ──── Customer History ────────────────────────────────────────────────────────

export function useCustomerHistory(customerId: string) {
  return useQuery<{
    appointments: Array<{
      id: string
      scheduledAt: string
      status: string
      durationMinutes: number
      service: { id: string; name: string; price: number }
      professional: { id: string; name: string }
      billing: { id: string; status: string; amount: number } | null
    }>
    sales: Array<{
      id: string
      quantity: number
      unitPrice: number
      totalPrice: number
      discount: number
      soldAt: string
      product: { id: string; name: string; unit: string; category: string | null }
    }>
  }>({
    queryKey: ['customer-history', customerId],
    queryFn: () => api.get(`/customers/${customerId}/history`).then((r) => r.data),
    enabled: !!customerId,
  })
}

// ──── Clinical Records ────────────────────────────────────────────────────────

export interface ClinicalRecord {
  id: string
  customerId: string
  professionalId: string | null
  title: string
  content: string
  type: 'note' | 'exam' | 'procedure' | 'prescription' | 'anamnesis'
  createdAt: string
  professional: { id: string; name: string } | null
}

export function useClinicalRecords(customerId: string) {
  return useQuery<Paginated<ClinicalRecord>>({
    queryKey: ['clinical-records', customerId],
    queryFn: () =>
      api.get('/clinical-records', { params: { customerId, limit: 100 } }).then((r) => r.data),
    enabled: !!customerId,
  })
}

export function useCreateClinicalRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      customerId: string
      professionalId?: string | null
      title: string
      content: string
      type: 'note' | 'exam' | 'procedure' | 'prescription' | 'anamnesis'
    }) => api.post('/clinical-records', data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['clinical-records', vars.customerId] })
    },
  })
}

// ──── Equipment ────────────────────────────────────────────────────────────────

export interface Equipment {
  id: string
  name: string
  description: string | null
  active: boolean
  createdAt: string
}

export function useEquipment() {
  return useQuery<Equipment[]>({
    queryKey: ['equipment'],
    queryFn: () => api.get('/equipment').then((r) => r.data),
  })
}

export function useCreateEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post('/equipment', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export function useUpdateEquipment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; active?: boolean }) =>
      api.patch(`/equipment/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export function useDeleteEquipment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`/equipment/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}
