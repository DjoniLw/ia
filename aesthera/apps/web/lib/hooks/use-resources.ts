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
  address?: CustomerAddress | null
  active: boolean
  allServices: boolean
  createdAt: string
  services?: Array<{ service: Service }>
  workingHours?: WorkingHour[]
}

export interface ProfessionalInput {
  name: string
  email: string
  phone?: string | null
  speciality?: string | null
  address?: CustomerAddress
}

export interface ProfessionalUpdateInput {
  name?: string
  email?: string
  phone?: string | null
  speciality?: string | null
  address?: CustomerAddress
  active?: boolean
  allServices?: boolean
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
  bodyDataConsentAt: string | null
  active: boolean
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
    mutationFn: (data: ProfessionalInput) =>
      api.post('/professionals', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  })
}

export function useUpdateProfessional(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProfessionalUpdateInput) =>
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
    mutationFn: (data: { serviceIds: string[]; allServices?: boolean }) =>
      api.put(`/professionals/${professionalId}/services`, data).then((r) => r.data),
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
  ncm: string | null
  cest: string | null
  cfop: string | null
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

export function useProductSales(params?: Record<string, string>, options?: { enabled?: boolean }) {
  return useQuery<Paginated<ProductSale>>({
    queryKey: ['product-sales', params],
    queryFn: () => api.get('/products/sales', { params }).then((r) => r.data),
    ...options,
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
  performedAt: string | null
  createdAt: string
  updatedAt: string
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
      performedAt?: string | null
    }) => api.post('/clinical-records', data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['clinical-records', vars.customerId] })
    },
  })
}

export function useUpdateClinicalRecord(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      customerId: string
      title?: string
      content?: string
      type?: 'note' | 'exam' | 'procedure' | 'prescription' | 'anamnesis'
      performedAt?: string | null
    }) => api.patch(`/clinical-records/${id}`, data).then((r) => r.data),
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

// ──── Rooms (Salas) ───────────────────────────────────────────────────────────

export interface Room {
  id: string
  name: string
  description: string | null
  active: boolean
  createdAt: string
}

export function useRooms() {
  return useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => api.get('/rooms').then((r) => r.data),
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post('/rooms', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  })
}

export function useUpdateRoom(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; active?: boolean }) =>
      api.patch(`/rooms/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  })
}

export function useDeleteRoom(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`/rooms/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  })
}

// ──── Supplies (Insumos) ──────────────────────────────────────────────────────

export interface Supply {
  id: string
  name: string
  description: string | null
  unit: string
  costPrice: number | null
  stock: number
  minStock: number
  active: boolean
  createdAt: string
}

export interface ServiceSupply {
  serviceId: string
  supplyId: string
  quantity: number
  usageUnit: string | null
  conversionFactor: number
  supply: Supply
}

export interface SupplyPurchase {
  id: string
  supplyId: string
  supplierName: string | null
  purchaseUnit: string
  purchaseQty: number
  conversionFactor: number
  stockIncrement: number
  unitCost: number
  totalCost: number
  notes: string | null
  purchasedAt: string
  createdAt: string
  supply: Pick<Supply, 'id' | 'name' | 'unit' | 'stock' | 'minStock' | 'active'>
}

export function useSupplies(params?: Record<string, string>) {
  return useQuery<{ items: Supply[]; total: number; page: number; limit: number }>({
    queryKey: ['supplies', params],
    queryFn: () => api.get('/supplies', { params }).then((r) => r.data),
  })
}

export function useCreateSupply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string | null; unit?: string; costPrice?: number | null; stock?: number; minStock?: number }) =>
      api.post('/supplies', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplies'] }),
  })
}

export function useUpdateSupply(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Supply>) => api.patch(`/supplies/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplies'] }),
  })
}

export function useDeleteSupply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/supplies/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplies'] }),
  })
}

export function useServiceSupplies(serviceId: string) {
  return useQuery<ServiceSupply[]>({
    queryKey: ['service-supplies', serviceId],
    queryFn: () => api.get(`/services/${serviceId}/supplies`).then((r) => r.data),
    enabled: !!serviceId,
  })
}

export function useAssignServiceSupplies(serviceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (supplies: Array<{ supplyId: string; quantity: number; usageUnit?: string | null; conversionFactor?: number }>) =>
      api.put(`/services/${serviceId}/supplies`, { supplies }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-supplies', serviceId] })
    },
  })
}

export function useSupplyPurchases(params?: Record<string, string>) {
  return useQuery<{ items: SupplyPurchase[]; total: number; page: number; limit: number }>({
    queryKey: ['supply-purchases', params],
    queryFn: () => api.get('/supply-purchases', { params }).then((r) => r.data),
  })
}

export function useCreateSupplyPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      supplyId: string
      supplierName?: string | null
      purchaseUnit: string
      purchaseQty: number
      conversionFactor: number
      unitCost: number
      notes?: string | null
      purchasedAt: string
    }) => api.post('/supply-purchases', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-purchases'] })
      qc.invalidateQueries({ queryKey: ['supplies'] })
    },
  })
}

export function useDeleteSupplyPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/supply-purchases/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-purchases'] })
      qc.invalidateQueries({ queryKey: ['supplies'] })
    },
  })
}

// ──── Available Equipment for time slot ───────────────────────────────────────

export interface EquipmentAvailability extends Equipment {
  available: boolean
}

export function useAvailableEquipment(scheduledAt: string, durationMinutes: number, excludeAppointmentId?: string) {
  return useQuery<EquipmentAvailability[]>({
    queryKey: ['available-equipment', scheduledAt, durationMinutes, excludeAppointmentId],
    queryFn: () =>
      api
        .get('/appointments/available-equipment', {
          params: { scheduledAt, durationMinutes, ...(excludeAppointmentId ? { excludeAppointmentId } : {}) },
        })
        .then((r) => r.data),
    enabled: !!(scheduledAt && durationMinutes),
    staleTime: 0,
  })
}

// ──── Contract Templates ───────────────────────────────────────────────────────

export interface ContractTemplate {
  id: string
  name: string
  description: string | null
  storageKey: string | null
  active: boolean
  createdAt: string
}

export function useContractTemplates() {
  return useQuery<ContractTemplate[]>({
    queryKey: ['contract-templates'],
    queryFn: () => api.get('/contract-templates').then((r) => r.data),
  })
}

export function useCreateContractTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; storageKey?: string }) =>
      api.post('/contract-templates', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  })
}

export function useUpdateContractTemplate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ContractTemplate>) =>
      api.patch(`/contract-templates/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  })
}

export function useDeleteContractTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/contract-templates/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  })
}

export function usePresignTemplate() {
  return useMutation({
    mutationFn: (data: { fileName: string; mimeType: string; size: number }) =>
      api.post('/contract-templates/presign', data).then((r) => r.data as { storageKey: string; presignedUrl: string }),
  })
}

// ──── Customer Contracts ───────────────────────────────────────────────────────

export interface CustomerContract {
  id: string
  clinicId: string
  customerId: string
  templateId: string | null
  label: string | null
  status: 'pending' | 'signed'
  signatureMode: 'assinafy' | 'manual' | 'uploaded' | null
  signLink: string | null
  externalId: string | null
  signedAt: string | null
  sentAt: string | null
  signerIp: string | null
  signToken: string | null
  signTokenExpiresAt: string | null
  createdAt: string
  template: { name: string; storageKey: string | null } | null
}

export function useCustomerContracts(customerId: string) {
  return useQuery<CustomerContract[]>({
    queryKey: ['customer-contracts', customerId],
    queryFn: () => api.get(`/customers/${customerId}/contracts`).then((r) => r.data),
    enabled: !!customerId,
  })
}

export function useCreateCustomerContract(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { templateId: string }) =>
      api.post(`/customers/${customerId}/contracts`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-contracts', customerId] }),
  })
}

export function useSendAssinafy(customerId: string, contractId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { customerEmail?: string }) =>
      api.post(`/customers/${customerId}/contracts/${contractId}/send-assinafy`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-contracts', customerId] }),
  })
}

export function useSignManual(customerId: string, contractId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { signature: string }) =>
      api.post(`/customers/${customerId}/contracts/${contractId}/sign-manual`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-contracts', customerId] }),
  })
}

export interface ContractView {
  id: string
  status: 'pending' | 'signed'
  signatureMode: 'assinafy' | 'manual' | 'uploaded' | null
  signedAt: string | null
  fileUrl: string | null
  signedFileUrl: string | null
  signature: string | null
}

export function useGetContractView(customerId: string) {
  return useMutation({
    mutationFn: (contractId: string) =>
      api.get(`/customers/${customerId}/contracts/${contractId}/view`).then((r) => r.data as ContractView),
  })
}

export function useSendContractWhatsApp(customerId: string) {
  return useMutation({
    mutationFn: ({ contractId, phone }: { contractId: string; phone: string }) =>
      api.post(`/customers/${customerId}/contracts/${contractId}/send-whatsapp`, { phone }).then((r) => r.data),
  })
}

export function usePresignSignedContract(customerId: string) {
  return useMutation({
    mutationFn: ({ contractId, fileName, mimeType, size }: { contractId: string; fileName: string; mimeType: string; size: number }) =>
      api.post(`/customers/${customerId}/contracts/${contractId}/presign-signed`, { fileName, mimeType, size })
        .then((r) => r.data as { storageKey: string; presignedUrl: string }),
  })
}

export function useConfirmSignedUpload(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contractId, storageKey }: { contractId: string; storageKey: string }) =>
      api.post(`/customers/${customerId}/contracts/${contractId}/confirm-upload-signed`, { storageKey }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-contracts', customerId] }),
  })
}

export function usePresignStandaloneSigned(customerId: string) {
  return useMutation({
    mutationFn: (data: { label: string; fileName: string; mimeType: string; size: number }) =>
      api.post(`/customers/${customerId}/contracts/presign-standalone-signed`, data)
        .then((r) => r.data as { storageKey: string; presignedUrl: string }),
  })
}

export function useConfirmStandaloneSigned(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { label: string; storageKey: string }) =>
      api.post(`/customers/${customerId}/contracts/confirm-standalone-signed`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-contracts', customerId] }),
  })
}

export function useSendRemoteSignLink(customerId: string, contractId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { phone: string }) =>
      api.post(`/customers/${customerId}/contracts/${contractId}/send-remote-sign`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-contracts', customerId] }),
  })
}
