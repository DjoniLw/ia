import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MeasurementSheet } from './use-measurement-sheets'

// ──── Types ────────────────────────────────────────────────────────────────────

export interface MeasurementValue {
  id: string
  fieldId: string
  value: string | null
  textValue: string | null
  field: {
    id: string
    name: string
    unit: string | null
    inputType: string
    isTextual: boolean
  }
}

export interface MeasurementTabularValue {
  id: string
  fieldId: string
  sheetColumnId: string
  subColumn: string
  value: string | null
  textValue: string | null
  field: {
    id: string
    name: string
    isTextual: boolean
    defaultValue: string | null
    subColumns: string[]
  }
  sheetColumn: {
    id: string
    name: string
    unit: string
    order: number
    isTextual: boolean
    defaultValue: string | null
  }
}

export interface MeasurementSheetRecord {
  id: string
  sessionId: string
  sheetId: string
  sheet: MeasurementSheet
  values: MeasurementValue[]
  tabularValues: MeasurementTabularValue[]
}

export interface MeasurementSessionFile {
  id: string
  name: string
  mimeType: string
  size: number
  category: string
  uploadedAt: string
}

export interface MeasurementSession {
  id: string
  clinicId: string
  customerId: string
  recordedAt: string
  notes: string | null
  createdAt: string
  updatedAt: string
  createdById: string
  sheetRecords: MeasurementSheetRecord[]
  files: MeasurementSessionFile[]
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ──── Input types ──────────────────────────────────────────────────────────────

interface SheetRecordInput {
  sheetId: string
  values?: Array<{ fieldId: string; value?: number; textValue?: string }>
  tabularValues?: Array<{ fieldId: string; columnId: string; subColumn?: string; value?: number; textValue?: string }>
}

export interface CreateSessionInput {
  customerId: string
  recordedAt: string
  notes?: string
  sheetRecords: SheetRecordInput[]
  fileIds?: string[]
}

export interface UpdateSessionInput {
  id: string
  customerId: string
  recordedAt?: string
  notes?: string
  sheetRecords?: SheetRecordInput[]
  fileIds?: string[]
}

// ──── Hooks ────────────────────────────────────────────────────────────────────

export function useMeasurementSessions(
  customerId: string,
  options?: { page?: number; limit?: number; enabled?: boolean },
) {
  const { page = 1, limit = 20, enabled = true } = options ?? {}
  return useQuery({
    queryKey: ['measurement-sessions', customerId, { page, limit }],
    queryFn: async () => {
      const res = await api.get<Paginated<MeasurementSession>>('/measurement-sessions', {
        params: { customerId, page, limit },
      })
      return res.data
    },
    enabled: enabled && !!customerId,
  })
}

export function useCreateMeasurementSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSessionInput) => {
      const res = await api.post<MeasurementSession>('/measurement-sessions', input)
      return res.data
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sessions', vars.customerId] })
    },
  })
}

export function useUpdateMeasurementSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateSessionInput) => {
      const res = await api.patch<MeasurementSession>(`/measurement-sessions/${id}`, input)
      return res.data
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sessions', vars.customerId] })
    },
  })
}

export function useDeleteMeasurementSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, customerId }: { id: string; customerId: string }) => {
      await api.delete(`/measurement-sessions/${id}`)
      return customerId
    },
    onSuccess: (customerId) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sessions', customerId] })
    },
  })
}
