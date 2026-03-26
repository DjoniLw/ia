import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ────────────────────────────────────────────────────────────────────

export type FileCategory = 'BEFORE_PHOTO' | 'AFTER_PHOTO' | 'MEASUREMENT' | 'EXAM' | 'OTHER'

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  BEFORE_PHOTO: 'Foto antes',
  AFTER_PHOTO: 'Foto depois',
  MEASUREMENT: 'Medição',
  EXAM: 'Exame',
  OTHER: 'Outro',
}

export interface BodyMeasurementField {
  id: string
  clinicId: string
  name: string
  unit: string
  order: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface BodyMeasurementValue {
  id: string
  fieldId: string
  value: string
  field: {
    id: string
    name: string
    unit: string
  }
}

export interface BodyMeasurementFile {
  id: string
  name: string
  mimeType: string
  size: number
  category: FileCategory
  uploadedAt: string
}

export interface BodyMeasurementRecord {
  id: string
  clinicId: string
  customerId: string
  recordedAt: string
  notes: string | null
  createdAt: string
  createdById: string
  values: BodyMeasurementValue[]
  files: BodyMeasurementFile[]
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

interface CreateFieldInput {
  name: string
  unit: string
  order?: number
}

interface UpdateFieldInput {
  name?: string
  unit?: string
  order?: number
  active?: boolean
}

interface CreateRecordInput {
  customerId: string
  recordedAt: string
  notes?: string
  values: Array<{ fieldId: string; value: number }>
  fileIds?: string[]
}

// ──── Fields hooks ─────────────────────────────────────────────────────────────

export function useBodyMeasurementFields({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: ['body-measurement-fields', { includeInactive }],
    queryFn: async () => {
      const url = includeInactive
        ? '/body-measurements/fields?includeInactive=true'
        : '/body-measurements/fields'
      const res = await api.get<BodyMeasurementField[]>(url)
      return res.data
    },
  })
}

export function useCreateBodyMeasurementField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateFieldInput) => {
      const res = await api.post<BodyMeasurementField>('/body-measurements/fields', input)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['body-measurement-fields'] })
    },
  })
}

export function useUpdateBodyMeasurementField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateFieldInput & { id: string }) => {
      const res = await api.patch<BodyMeasurementField>(`/body-measurements/fields/${id}`, input)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['body-measurement-fields'] })
    },
  })
}

export function useDeleteBodyMeasurementField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/body-measurements/fields/${id}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['body-measurement-fields'] })
    },
  })
}

// ──── Records hooks ────────────────────────────────────────────────────────────

export function useBodyMeasurementRecords(customerId: string, enabled = true) {
  return useQuery({
    queryKey: ['body-measurement-records', customerId],
    queryFn: async () => {
      const res = await api.get<Paginated<BodyMeasurementRecord>>('/body-measurements', {
        params: { customerId, limit: 50 },
      })
      return res.data
    },
    enabled: enabled && !!customerId,
  })
}

export function useCreateBodyMeasurementRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateRecordInput) => {
      const res = await api.post<BodyMeasurementRecord>('/body-measurements', input)
      return res.data
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['body-measurement-records', vars.customerId] })
    },
  })
}

export function useDeleteBodyMeasurementRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, customerId }: { id: string; customerId: string }) => {
      await api.delete(`/body-measurements/${id}`)
      return customerId
    },
    onSuccess: (customerId) => {
      void qc.invalidateQueries({ queryKey: ['body-measurement-records', customerId] })
    },
  })
}

// ──── Upload hooks ─────────────────────────────────────────────────────────────

interface PresignResult {
  presignedUrl: string
  storageKey: string
  expiresAt: string
}

interface ConfirmResult {
  id: string
  storageKey: string
  name: string
  mimeType: string
  size: number
  category: FileCategory
}

export async function presignUpload(input: {
  fileName: string
  mimeType: string
  size: number
  customerId: string
  category: FileCategory
}): Promise<PresignResult> {
  const res = await api.post<PresignResult>('/uploads/presign', input)
  return res.data
}

export async function confirmUpload(input: {
  storageKey: string
  customerId: string
  name: string
  mimeType: string
  size: number
  category: FileCategory
}): Promise<ConfirmResult> {
  const res = await api.post<ConfirmResult>('/uploads/confirm', input)
  return res.data
}

export async function getUploadUrl(fileId: string): Promise<{ url: string; expiresAt: string }> {
  const res = await api.get<{ url: string; expiresAt: string }>(`/uploads/${fileId}/url`)
  return res.data
}
