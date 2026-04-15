import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ────────────────────────────────────────────────────────────────────

export type MeasurementSheetType = 'SIMPLE' | 'TABULAR'
export type MeasurementInputType = 'INPUT' | 'CHECK'
export type MeasurementCategory =
  | 'CORPORAL'
  | 'FACIAL'
  | 'DERMATO_FUNCIONAL'
  | 'NUTRICIONAL'
  | 'POSTURAL'
  | 'PERSONALIZADA'
export type MeasurementScope = 'SYSTEM' | 'CUSTOMER'

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
  defaultValue: string | null
  subColumns: string[]
  order: number
  active: boolean
}

export interface MeasurementSheet {
  id: string
  clinicId: string
  name: string
  type: MeasurementSheetType
  category: MeasurementCategory
  scope: MeasurementScope
  customerId: string | null
  active: boolean
  order: number
  createdAt: string
  updatedAt: string
  columns: MeasurementSheetColumn[]
  fields: MeasurementField[]
}

export interface MeasurementTemplate {
  id: string
  name: string
  type: MeasurementSheetType
  category: MeasurementCategory
  fieldsCount: number
  columnsCount: number
}

// ──── Input types ──────────────────────────────────────────────────────────────

interface CreateSheetInput {
  name: string
  type: MeasurementSheetType
  order?: number
  category?: MeasurementCategory
  scope?: MeasurementScope
}

interface UpdateSheetInput {
  id: string
  name?: string
  order?: number
  active?: boolean
  category?: MeasurementCategory
}

interface CreateFieldInput {
  name: string
  inputType: MeasurementInputType
  unit?: string
  order?: number
  isTextual?: boolean
  defaultValue?: string
  subColumns?: string[]
}

interface UpdateFieldInput {
  fieldId: string
  sheetId: string
  name?: string
  inputType?: MeasurementInputType
  unit?: string
  order?: number
  active?: boolean
  isTextual?: boolean
  defaultValue?: string | null
  subColumns?: string[]
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
  isTextual?: boolean
  defaultValue?: string
}

interface UpdateSheetColumnInput {
  sheetId: string
  colId: string
  name?: string
  inputType?: MeasurementInputType
  unit?: string
  order?: number
  isTextual?: boolean
  defaultValue?: string | null
}

interface DeleteSheetColumnInput {
  sheetId: string
  colId: string
}

// ──── Fichas (Sheets) ──────────────────────────────────────────────────────────

interface UseMeasurementSheetsOptions {
  includeInactive?: boolean
  scope?: MeasurementScope
  category?: MeasurementCategory
}

export function useMeasurementSheets({
  includeInactive = false,
  scope,
  category,
}: UseMeasurementSheetsOptions = {}) {
  return useQuery({
    queryKey: ['measurement-sheets', { includeInactive, scope, category }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (includeInactive) params.set('includeInactive', 'true')
      if (scope) params.set('scope', scope)
      if (category) params.set('category', category)
      const query = params.toString()
      const url = query ? `/measurement-sheets?${query}` : '/measurement-sheets'
      const res = await api.get<MeasurementSheet[]>(url)
      return res.data
    },
  })
}

export function useMeasurementTemplates() {
  return useQuery({
    queryKey: ['measurement-templates'],
    staleTime: Infinity,
    queryFn: async () => {
      const res = await api.get<MeasurementTemplate[]>('/measurement-sheets/templates')
      return res.data
    },
  })
}

export function useCopyMeasurementTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await api.post<MeasurementSheet>(
        `/measurement-sheets/templates/${templateId}/copy`,
      )
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
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
