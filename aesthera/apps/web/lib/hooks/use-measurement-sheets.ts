import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ────────────────────────────────────────────────────────────────────

export type MeasurementFieldType = 'SIMPLE' | 'TABULAR' | 'CHECK'

export interface MeasurementSubColumn {
  id: string
  fieldId: string
  name: string
  unit: string
  order: number
}

export interface MeasurementField {
  id: string
  sheetId: string
  clinicId: string
  name: string
  unit: string | null
  type: MeasurementFieldType
  order: number
  active: boolean
  columns: MeasurementSubColumn[]
}

export interface MeasurementSheet {
  id: string
  clinicId: string
  name: string
  active: boolean
  order: number
  createdAt: string
  updatedAt: string
  fields: MeasurementField[]
}


// ──── Input types ──────────────────────────────────────────────────────────────

interface CreateSheetInput {
  name: string
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
  type: MeasurementFieldType
  unit?: string
  order?: number
}

interface UpdateFieldInput {
  fieldId: string
  sheetId: string
  name?: string
  unit?: string
  order?: number
  active?: boolean
}

interface ReorderFieldsInput {
  sheetId: string
  fields: Array<{ id: string; order: number }>
}

interface CreateSubColumnInput {
  sheetId: string
  fieldId: string
  name: string
  unit: string
  order?: number
}

interface UpdateSubColumnInput {
  sheetId: string
  fieldId: string
  colId: string
  name?: string
  unit?: string
  order?: number
}

interface DeleteSubColumnInput {
  sheetId: string
  fieldId: string
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

export function useMeasurementSheetFields(sheetId: string, enabled = true) {
  return useQuery({
    queryKey: ['measurement-sheet-fields', sheetId],
    queryFn: async () => {
      const res = await api.get<MeasurementField[]>(`/measurement-sheets/${sheetId}/fields`)
      return res.data
    },
    enabled: enabled && !!sheetId,
  })
}

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
      void qc.invalidateQueries({ queryKey: ['measurement-sheet-fields', sheetId] })
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
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
      void qc.invalidateQueries({ queryKey: ['measurement-sheet-fields', vars.sheetId] })
    },
  })
}

export function useDeleteMeasurementField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, fieldId }: { sheetId: string; fieldId: string }) => {
      await api.delete(`/measurement-sheets/${sheetId}/fields/${fieldId}`)
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
      void qc.invalidateQueries({ queryKey: ['measurement-sheet-fields', vars.sheetId] })
    },
  })
}

export function useReorderMeasurementFields() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, fields }: ReorderFieldsInput) => {
      await api.post(`/measurement-sheets/${sheetId}/fields/reorder`, fields)
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
      void qc.invalidateQueries({ queryKey: ['measurement-sheet-fields', vars.sheetId] })
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

// ──── Sub-colunas (Sub-columns) ─────────────────────────────────────────────────

export function useCreateSubColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, fieldId, ...input }: CreateSubColumnInput) => {
      const res = await api.post<MeasurementSubColumn>(
        `/measurement-sheets/${sheetId}/fields/${fieldId}/columns`,
        input,
      )
      return res.data
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
      void qc.invalidateQueries({ queryKey: ['measurement-sheet-fields', vars.sheetId] })
    },
  })
}

export function useUpdateSubColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, fieldId, colId, ...input }: UpdateSubColumnInput) => {
      const res = await api.patch<MeasurementSubColumn>(
        `/measurement-sheets/${sheetId}/fields/${fieldId}/columns/${colId}`,
        input,
      )
      return res.data
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
      void qc.invalidateQueries({ queryKey: ['measurement-sheet-fields', vars.sheetId] })
    },
  })
}

export function useDeleteSubColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sheetId, fieldId, colId }: DeleteSubColumnInput) => {
      await api.delete(`/measurement-sheets/${sheetId}/fields/${fieldId}/columns/${colId}`)
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
      void qc.invalidateQueries({ queryKey: ['measurement-sheet-fields', vars.sheetId] })
    },
  })
}
