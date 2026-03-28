import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ────────────────────────────────────────────────────────────────────

export type MeasurementSheetType = 'SIMPLE' | 'TABULAR'
export type MeasurementInputType = 'INPUT' | 'CHECK'

export interface MeasurementSheetColumn {
  id: string
  sheetId: string
  name: string
  inputType: MeasurementInputType
  unit: string | null
  isTextual: boolean
  defaultValue: string | null
  order: number
}

export interface MeasurementField {
  id: string
  sheetId: string
  clinicId: string
  name: string
  inputType: MeasurementInputType
  unit: string | null
  isTextual: boolean
  subColumns: string[]
  order: number
  active: boolean
}

export interface MeasurementSheet {
  id: string
  clinicId: string
  name: string
  type: MeasurementSheetType
  active: boolean
  order: number
  createdAt: string
  updatedAt: string
  columns: MeasurementSheetColumn[]
  fields: MeasurementField[]
}

// ──── Input types ──────────────────────────────────────────────────────────────

interface CreateSheetInput {
  name: string
  type: MeasurementSheetType
  order?: number
}

interface UpdateSheetInput {
  id: string
  name?: string
  order?: number
  active?: boolean
}

interface CreateFieldInput {
  name: string
  inputType: MeasurementInputType
  unit?: string
  order?: number
}

interface UpdateFieldInput {
  fieldId: string
  sheetId: string
  name?: string
  inputType?: MeasurementInputType
  unit?: string
  order?: number
  active?: boolean
}

interface ReorderFieldsInput {
  sheetId: string
  fields: Array<{ id: string; order: number }>
}

interface CreateSheetColumnInput {
  sheetId: string
  name: string
  inputType: MeasurementInputType
  unit?: string
  order?: number
}

interface UpdateSheetColumnInput {
  sheetId: string
  colId: string
  name?: string
  inputType?: MeasurementInputType
  unit?: string
  order?: number
}

interface DeleteSheetColumnInput {
  sheetId: string
  colId: string
}

// ──── Fichas (Sheets) ──────────────────────────────────────────────────────────

export function useMeasurementSheets({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: ['measurement-sheets', { includeInactive }],
    queryFn: async () => {
      const url = includeInactive
        ? '/measurement-sheets?includeInactive=true'
        : '/measurement-sheets'
      const res = await api.get<MeasurementSheet[]>(url)
      return res.data
    },
  })
}

export function useCreateMeasurementSheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSheetInput) => {
      const res = await api.post<MeasurementSheet>('/measurement-sheets', input)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useUpdateMeasurementSheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateSheetInput) => {
      const res = await api.patch<MeasurementSheet>(`/measurement-sheets/${id}`, input)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useDeleteMeasurementSheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/measurement-sheets/${id}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

// ──── Campos (Fields) ──────────────────────────────────────────────────────────

export function useCreateMeasurementField(sheetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateFieldInput) => {
      const res = await api.post<MeasurementField>(
        `/measurement-sheets/${sheetId}/fields`,
        input,
      )
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useUpdateMeasurementField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, fieldId, ...input }: UpdateFieldInput) => {
      const res = await api.patch<MeasurementField>(
        `/measurement-sheets/${sheetId}/fields/${fieldId}`,
        input,
      )
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useDeleteMeasurementField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, fieldId }: { sheetId: string; fieldId: string }) => {
      await api.delete(`/measurement-sheets/${sheetId}/fields/${fieldId}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useReorderMeasurementFields() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, fields }: ReorderFieldsInput) => {
      await api.post(`/measurement-sheets/${sheetId}/fields/reorder`, fields)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useReorderMeasurementSheets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sheets: Array<{ id: string; order: number }>) => {
      await api.post('/measurement-sheets/reorder', sheets)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

// ──── Colunas das fichas TABULAR ───────────────────────────────────────────────

export function useCreateSheetColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, ...input }: CreateSheetColumnInput) => {
      const res = await api.post<MeasurementSheetColumn>(
        `/measurement-sheets/${sheetId}/columns`,
        input,
      )
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useUpdateSheetColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, colId, ...input }: UpdateSheetColumnInput) => {
      const res = await api.patch<MeasurementSheetColumn>(
        `/measurement-sheets/${sheetId}/columns/${colId}`,
        input,
      )
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useDeleteSheetColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, colId }: DeleteSheetColumnInput) => {
      await api.delete(`/measurement-sheets/${sheetId}/columns/${colId}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}

export function useReorderSheetColumns() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, columns }: { sheetId: string; columns: Array<{ id: string; order: number }> }) => {
      await api.post(`/measurement-sheets/${sheetId}/columns/reorder`, columns)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
    },
  })
}
