'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Power,
  Ruler,
  Trash2,
  Table2,
  List,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useMeasurementSheets,
  useCreateMeasurementSheet,
  useUpdateMeasurementSheet,
  useDeleteMeasurementSheet,
  useReorderMeasurementSheets,
  useCreateMeasurementField,
  useUpdateMeasurementField,
  useDeleteMeasurementField,
  useReorderMeasurementFields,
  useCreateSheetColumn,
  useUpdateSheetColumn,
  useDeleteSheetColumn,
  useReorderSheetColumns,
  type MeasurementSheet,
  type MeasurementField,
  type MeasurementSheetColumn,
  type MeasurementSheetType,
  type MeasurementInputType,
} from '@/lib/hooks/use-measurement-sheets'

const MAX_ACTIVE_SHEETS = 20
const MAX_ACTIVE_FIELDS = 30
const MAX_SHEET_COLUMNS = 10

// â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const sheetSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  type: z.enum(['SIMPLE', 'TABULAR']),
})
type SheetForm = z.infer<typeof sheetSchema>

const fieldSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  inputType: z.enum(['INPUT', 'CHECK']),
  unit: z.string().max(20).optional(),
  isTextual: z.boolean().default(false),
  defaultValue: z.string().max(500).optional(),
})
type FieldForm = z.infer<typeof fieldSchema>

const columnSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  inputType: z.enum(['INPUT', 'CHECK']),
  unit: z.string().max(20).optional(),
  isTextual: z.boolean().default(false),
  defaultValue: z.string().max(500).optional(),
})
type ColumnForm = z.infer<typeof columnSchema>

// â”€â”€ Utilitários â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function inputTypeBadge(inputType: MeasurementInputType) {
  if (inputType === 'INPUT')
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
        Digitação
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      Marcação
    </span>
  )
}

function sheetTypeBadge(type: MeasurementSheetType) {
  if (type === 'TABULAR')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
        <Table2 className="h-3 w-3" />
        Tabular
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <List className="h-3 w-3" />
      Simples
    </span>
  )
}

// â”€â”€ Dialog de Ficha â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SheetDialog({
  open,
  sheet,
  onClose,
}: {
  open: boolean
  sheet?: MeasurementSheet
  onClose: () => void
}) {
  const createMutation = useCreateMeasurementSheet()
  const updateMutation = useUpdateMeasurementSheet()
  const isPending = createMutation.isPending || updateMutation.isPending

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<SheetForm>({
    resolver: zodResolver(sheetSchema),
    defaultValues: { name: sheet?.name ?? '', type: sheet?.type ?? 'SIMPLE' },
  })

  const selectedType = watch('type')

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (sheet) {
        await updateMutation.mutateAsync({ id: sheet.id, name: data.name })
        toast.success('Ficha atualizada')
      } else {
        await createMutation.mutateAsync({ name: data.name, type: data.type })
        toast.success('Ficha criada')
      }
      onClose()
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
      if (d?.error === 'CONFLICT') {
        toast.error('Já existe uma ficha com este nome')
      } else if (d?.message === 'MAX_SHEETS_REACHED') {
        toast.error(`Limite de ${MAX_ACTIVE_SHEETS} fichas ativas atingido`)
      } else {
        toast.error('Erro ao salvar ficha')
      }
    }
  })

  return (
    <Dialog open={open} onClose={onClose} isDirty={isDirty} className="max-w-sm">
      <DialogTitle>{sheet ? 'Editar ficha' : 'Nova ficha'}</DialogTitle>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sheet-name">Nome da ficha *</Label>
          <Input id="sheet-name" {...register('name')} placeholder="Ex: Perimetria, Plicometria" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Tipo da ficha — somente na criação */}
        {!sheet && (
          <div className="space-y-2">
            <Label>Tipo da ficha *</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['SIMPLE', 'TABULAR'] as MeasurementSheetType[]).map((t) => (
                <label
                  key={t}
                  className={[
                    'cursor-pointer rounded-lg border p-3 transition-colors',
                    selectedType === t
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  <input type="radio" value={t} {...register('type')} className="sr-only" />
                  <div className="flex items-center gap-2 mb-1">
                    {t === 'SIMPLE' ? <List className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
                    <span className="text-sm font-medium">{t === 'SIMPLE' ? 'Simples' : 'Tabular'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {t === 'SIMPLE'
                      ? 'Uma lista de campos. Cada um pode ser digitação ou marcação.'
                      : 'Uma tabela: linhas são os campos, colunas são definidas por você.'}
                  </p>
                </label>
              ))}
            </div>
            {selectedType === 'TABULAR' && (
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                Exemplo: Perimetria com colunas FEG 1, FEG 2, Adiposidade — e linhas Braço, Pescoço, Cintura.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending || !isDirty}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {sheet ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// â”€â”€ Dialog de Campo (linha) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FieldDialog({
  open,
  sheetId,
  sheetType,
  field,
  nextOrder,
  onClose,
}: {
  open: boolean
  sheetId: string
  sheetType: MeasurementSheetType
  field?: MeasurementField
  nextOrder?: number
  onClose: () => void
}) {
  const createField = useCreateMeasurementField(sheetId)
  const updateField = useUpdateMeasurementField()
  const isPending = createField.isPending || updateField.isPending

  // Estado local para sub-colunas (tags), independente do RHF
  const [subColumns, setSubColumns] = useState<string[]>(field?.subColumns ?? [])
  const [subColInput, setSubColInput] = useState('')
  const initialSubCols = useRef(field?.subColumns ?? [])
  const isSubColsDirty = JSON.stringify(subColumns) !== JSON.stringify(initialSubCols.current)

  // Estado para override do valor padrão por campo (null = herda coluna, string = override)
  const initialOverrideDefault = field?.defaultValue !== null && field?.defaultValue !== undefined
  const [overrideDefault, setOverrideDefault] = useState(initialOverrideDefault)
  const isOverrideDirty = overrideDefault !== initialOverrideDefault

  const addSubCol = () => {
    const val = subColInput.trim()
    if (!val || subColumns.includes(val) || subColumns.length >= 8) return
    setSubColumns((prev) => [...prev, val])
    setSubColInput('')
  }

  const removeSubCol = (col: string) => setSubColumns((prev) => prev.filter((c) => c !== col))

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FieldForm>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name: field?.name ?? '',
      inputType: field?.inputType ?? 'INPUT',
      unit: field?.unit ?? '',
      isTextual: field?.isTextual ?? false,
      defaultValue: field?.defaultValue ?? '',
    },
  })

  const inputType = watch('inputType')
  const isTextual = watch('isTextual')

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (field) {
        await updateField.mutateAsync({
          sheetId,
          fieldId: field.id,
          name: data.name,
          ...(sheetType === 'SIMPLE' && data.inputType === 'INPUT' && !data.isTextual ? { unit: data.unit || undefined } : {}),
          inputType: data.inputType,
          isTextual: data.isTextual,
          defaultValue: sheetType === 'TABULAR' ? (overrideDefault ? (data.defaultValue ?? '') : null) : null,
          subColumns: sheetType === 'TABULAR' ? subColumns : [],
        })
        toast.success('Campo atualizado')
      } else {
        await createField.mutateAsync({
          name: data.name,
          inputType: data.inputType,
          ...(sheetType === 'SIMPLE' && data.inputType === 'INPUT' && !data.isTextual ? { unit: data.unit || undefined } : {}),
          isTextual: data.isTextual,
          defaultValue: sheetType === 'TABULAR' ? (overrideDefault ? (data.defaultValue ?? '') : undefined) : undefined,
          subColumns: sheetType === 'TABULAR' ? subColumns : [],
          order: nextOrder,
        })
        toast.success('Campo criado')
      }
      onClose()
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
      if (d?.error === 'CONFLICT') {
        toast.error('Já existe um campo com este nome nesta ficha')
      } else if (d?.message === 'MAX_FIELDS_REACHED') {
        toast.error(`Limite de ${MAX_ACTIVE_FIELDS} campos ativos atingido`)
      } else {
        toast.error('Erro ao salvar campo')
      }
    }
  })

  return (
    <Dialog open={open} onClose={onClose} isDirty={isDirty} className="max-w-sm">
      <DialogTitle>{field ? 'Editar campo' : 'Novo campo'}</DialogTitle>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="field-name">Nome *</Label>
          <Input
            id="field-name"
            {...register('name')}
            placeholder={sheetType === 'TABULAR' ? 'Ex: Braço, Pescoço, Cintura' : 'Ex: Peso, Altura, IMC'}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Tipo de entrada — somente em fichas SIMPLE */}
        {sheetType === 'SIMPLE' && (
          <div className="space-y-2">
            <Label>Tipo de entrada *</Label>
            <div className="flex gap-2">
              {(['INPUT', 'CHECK'] as MeasurementInputType[]).map((t) => (
                <label
                  key={t}
                  className={[
                    'flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm transition-colors',
                    inputType === t
                      ? 'border-primary bg-primary/5 font-medium text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  ].join(' ')}
                >
                  <input type="radio" value={t} {...register('inputType')} className="sr-only" />
                  {t === 'INPUT' ? 'Digitação' : 'Marcação'}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Unidade — somente para SIMPLE + INPUT (não-textual) */}
        {sheetType === 'SIMPLE' && inputType === 'INPUT' && !isTextual && (
          <div className="space-y-1.5">
            <Label htmlFor="field-unit">Unidade</Label>
            <Input id="field-unit" {...register('unit')} placeholder="Ex: kg, cm, mm, %" />
          </div>
        )}

        {/* Campo textual — somente SIMPLE + INPUT */}
        {sheetType === 'SIMPLE' && inputType === 'INPUT' && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" {...register('isTextual')} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Campo de texto livre (não numérico)</span>
          </label>
        )}

        {/* Sub-colunas — somente fichas TABULAR */}
        {sheetType === 'TABULAR' && (
          <div className="space-y-2">
            <Label>
              Sub-colunas{' '}
              <span className="text-muted-foreground font-normal">(opcional — máx. 8)</span>
            </Label>
            {/* Tags existentes */}
            {subColumns.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {subColumns.map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {col}
                    <button
                      type="button"
                      onClick={() => removeSubCol(col)}
                      className="ml-0.5 rounded-full hover:text-destructive focus:outline-none"
                      aria-label={`Remover sub-coluna ${col}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Input para adicionar */}
            {subColumns.length < 8 && (
              <div className="flex gap-2">
                <Input
                  value={subColInput}
                  onChange={(e) => setSubColInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addSubCol() }
                  }}
                  placeholder="Ex: D (Direita)"
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSubCol}
                  disabled={!subColInput.trim() || subColumns.includes(subColInput.trim())}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Cada sub-coluna cria um campo separado dentro da célula.
              Ex: <strong>D</strong> + <strong>E</strong> → Direita e Esquerda.
            </p>
          </div>
        )}

        {/* Valor padrão por campo — somente fichas TABULAR */}
        {sheetType === 'TABULAR' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overrideDefault}
                onChange={(e) => {
                  setOverrideDefault(e.target.checked)
                  if (!e.target.checked) setValue('defaultValue', '')
                }}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Personalizar valor padrão deste campo</span>
            </label>
            {overrideDefault ? (
              <div className="space-y-1">
                <Input
                  id="field-default"
                  {...register('defaultValue')}
                  placeholder="Ex: 00 cm abaixo do umbigo"
                  className="h-8 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Sobrescreve o padrão da coluna. Deixe vazio para que este campo não exiba nenhum valor padrão.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Este campo usará o valor padrão definido em cada coluna.
              </p>
            )}
          </div>
        )}

        {/* Em fichas TABULAR, o tipo de entrada fica nas colunas */}
        {sheetType === 'TABULAR' && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
            Em fichas tabulares, o tipo de entrada (digitação/marcação) é definido por coluna, não por campo.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending || (!isDirty && !isSubColsDirty && !isOverrideDirty)}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {field ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// â”€â”€ Dialog de Coluna (fichas TABULAR) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ColumnDialog({
  open,
  sheetId,
  column,
  nextOrder,
  onClose,
}: {
  open: boolean
  sheetId: string
  column?: MeasurementSheetColumn
  nextOrder?: number
  onClose: () => void
}) {
  const createColumn = useCreateSheetColumn()
  const updateColumn = useUpdateSheetColumn()
  const isPending = createColumn.isPending || updateColumn.isPending

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<ColumnForm>({
    resolver: zodResolver(columnSchema),
    defaultValues: {
      name: column?.name ?? '',
      inputType: column?.inputType ?? 'INPUT',
      unit: column?.unit ?? '',
      isTextual: column?.isTextual ?? false,
      defaultValue: column?.defaultValue ?? '',
    },
  })

  const inputType = watch('inputType')
  const isTextual = watch('isTextual')

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (column) {
        await updateColumn.mutateAsync({
          sheetId,
          colId: column.id,
          name: data.name,
          inputType: data.inputType,
          unit: data.inputType === 'INPUT' && !data.isTextual ? (data.unit || undefined) : undefined,
          isTextual: data.isTextual,
          defaultValue: data.isTextual ? (data.defaultValue || null) : null,
        })
        toast.success('Coluna atualizada')
      } else {
        await createColumn.mutateAsync({
          sheetId,
          name: data.name,
          inputType: data.inputType,
          unit: data.inputType === 'INPUT' && !data.isTextual ? (data.unit || undefined) : undefined,
          isTextual: data.isTextual,
          defaultValue: data.isTextual ? (data.defaultValue || undefined) : undefined,
          order: nextOrder,
        })
        toast.success('Coluna criada')
      }
      onClose()
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
      if (d?.error === 'CONFLICT') {
        toast.error('Já existe uma coluna com este nome nesta ficha')
      } else if (d?.message === 'MAX_COLUMNS_REACHED') {
        toast.error(`Limite de ${MAX_SHEET_COLUMNS} colunas atingido`)
      } else {
        toast.error('Erro ao salvar coluna')
      }
    }
  })

  return (
    <Dialog open={open} onClose={onClose} isDirty={isDirty} className="max-w-sm">
      <DialogTitle>{column ? 'Editar coluna' : 'Nova coluna'}</DialogTitle>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="col-name">Nome *</Label>
          <Input id="col-name" {...register('name')} placeholder="Ex: FEG 1, FEG 2, Adiposidade" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Tipo de entrada *</Label>
          <div className="flex gap-2">
            {(['INPUT', 'CHECK'] as MeasurementInputType[]).map((t) => (
              <label
                key={t}
                className={[
                  'flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm transition-colors',
                  inputType === t
                    ? 'border-primary bg-primary/5 font-medium text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                ].join(' ')}
              >
                <input type="radio" value={t} {...register('inputType')} className="sr-only" />
                {t === 'INPUT' ? 'Digitação' : 'Marcação'}
              </label>
            ))}
          </div>
        </div>

        {inputType === 'INPUT' && !isTextual && (
          <div className="space-y-1.5">
            <Label htmlFor="col-unit">Unidade</Label>
            <Input id="col-unit" {...register('unit')} placeholder="Ex: cm, mm, %" />
          </div>
        )}

        {/* Coluna textual — valor padrão e sem unidade */}
        {inputType === 'INPUT' && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" {...register('isTextual')} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Coluna de texto livre (não numérica)</span>
          </label>
        )}

        {/* Valor padrão — somente para colunas textuais */}
        {isTextual && (
          <div className="space-y-1.5">
            <Label htmlFor="col-default">Valor padrão <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              id="col-default"
              {...register('defaultValue')}
              placeholder="Ex: 00 cm acima do umbigo"
            />
            <p className="text-[11px] text-muted-foreground">Pré-preenche o campo ao abrir o formulário de registro.</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending || !isDirty}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {column ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// â”€â”€ Item de campo sortable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SortableFieldItem({
  field,
  sheetType,
  reorderPending,
  updatePending,
  deletePending,
  onEdit,
  onToggle,
  onDelete,
}: {
  field: MeasurementField
  sheetType: MeasurementSheetType
  reorderPending: boolean
  updatePending: boolean
  deletePending: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={['flex items-center gap-2 px-3 py-2.5 bg-card text-sm', !field.active && 'opacity-50'].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
        disabled={reorderPending}
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="font-medium truncate">{field.name}</span>
        {sheetType === 'SIMPLE' && inputTypeBadge(field.inputType)}
        {sheetType === 'SIMPLE' && field.inputType === 'INPUT' && field.unit && (
          <span className="text-xs text-muted-foreground">{field.unit}</span>
        )}
        {!field.active && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inativo</span>
        )}
      </div>

      <div className="flex gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} aria-label="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onToggle}
          disabled={updatePending}
          aria-label={field.active ? 'Desativar' : 'Reativar'}
        >
          <Power className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onDelete}
          disabled={deletePending}
          aria-label="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// â”€â”€ Item de coluna sortable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SortableColumnItem({
  column,
  deletePending,
  onEdit,
  onDelete,
}: {
  column: MeasurementSheetColumn
  deletePending: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: column.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-card text-sm"
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none" aria-label="Arrastar">
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="font-medium truncate">{column.name}</span>
        {inputTypeBadge(column.inputType)}
        {column.inputType === 'INPUT' && column.unit && (
          <span className="text-xs text-muted-foreground">{column.unit}</span>
        )}
      </div>
      <div className="flex gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} aria-label="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete} disabled={deletePending} aria-label="Excluir">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// â”€â”€ Painel inline de uma Ficha â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SheetPanel({ sheet, onEditSheet }: { sheet: MeasurementSheet; onEditSheet: (s: MeasurementSheet) => void }) {
  const updateMutation = useUpdateMeasurementSheet()
  const deleteSheet = useDeleteMeasurementSheet()
  const updateField = useUpdateMeasurementField()
  const deleteField = useDeleteMeasurementField()
  const reorderFields = useReorderMeasurementFields()
  const deleteColumn = useDeleteSheetColumn()
  const reorderColumns = useReorderSheetColumns()

  const [fieldDialogOpen, setFieldDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<MeasurementField | undefined>()
  const [columnDialogOpen, setColumnDialogOpen] = useState(false)
  const [editingColumn, setEditingColumn] = useState<MeasurementSheetColumn | undefined>()

  const [localFields, setLocalFields] = useState(() => [...sheet.fields].sort((a, b) => a.order - b.order))
  const [localColumns, setLocalColumns] = useState(() => [...sheet.columns].sort((a, b) => a.order - b.order))
  useEffect(() => { setLocalFields([...sheet.fields].sort((a, b) => a.order - b.order)) }, [sheet.fields])
  useEffect(() => { setLocalColumns([...sheet.columns].sort((a, b) => a.order - b.order)) }, [sheet.columns])
  const activeFieldCount = localFields.filter((f) => f.active).length

  const handleToggleField = async (field: MeasurementField) => {
    try {
      await updateField.mutateAsync({ sheetId: sheet.id, fieldId: field.id, active: !field.active })
      toast.success(field.active ? `Campo "${field.name}" desativado` : `Campo "${field.name}" reativado`)
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { message?: string } } })?.response?.data
      if (d?.message === 'MAX_FIELDS_REACHED') {
        toast.error(`Limite de ${MAX_ACTIVE_FIELDS} campos ativos atingido`)
      } else {
        toast.error('Erro ao atualizar campo')
      }
    }
  }

  const handleDeleteField = async (field: MeasurementField) => {
    try {
      await deleteField.mutateAsync({ sheetId: sheet.id, fieldId: field.id })
      toast.success(`Campo "${field.name}" removido`)
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { message?: string } } })?.response?.data
      toast.error(d?.message === 'HAS_HISTORY' ? `Não é possível excluir "${field.name}" pois possui histórico — desative em vez de excluir.` : 'Erro ao remover campo')
    }
  }

  const handleFieldDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localFields.findIndex((f) => f.id === active.id)
    const newIndex = localFields.findIndex((f) => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const previous = localFields
    const reordered = arrayMove(localFields, oldIndex, newIndex)
    setLocalFields(reordered)
    try { await reorderFields.mutateAsync({ sheetId: sheet.id, fields: reordered.map((f, i) => ({ id: f.id, order: i })) }) }
    catch { setLocalFields(previous); toast.error('Erro ao reordenar campos') }
  }

  const handleDeleteColumn = async (col: MeasurementSheetColumn) => {
    try {
      await deleteColumn.mutateAsync({ sheetId: sheet.id, colId: col.id })
      toast.success(`Coluna "${col.name}" removida`)
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { message?: string } } })?.response?.data
      toast.error(d?.message === 'HAS_HISTORY' ? `Não é possível excluir "${col.name}" pois possui histórico registrado.` : 'Erro ao remover coluna')
    }
  }

  const handleColumnDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localColumns.findIndex((c) => c.id === active.id)
    const newIndex = localColumns.findIndex((c) => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const previous = localColumns
    const reordered = arrayMove(localColumns, oldIndex, newIndex)
    setLocalColumns(reordered)
    try { await reorderColumns.mutateAsync({ sheetId: sheet.id, columns: reordered.map((c, i) => ({ id: c.id, order: i })) }) }
    catch { setLocalColumns(previous); toast.error('Erro ao reordenar colunas') }
  }

  const handleToggleSheet = async () => {
    try {
      await updateMutation.mutateAsync({ id: sheet.id, active: !sheet.active })
      toast.success(sheet.active ? 'Ficha desativada' : 'Ficha reativada')
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { message?: string } } })?.response?.data
      toast.error(d?.message === 'MAX_SHEETS_REACHED' ? `Limite de ${MAX_ACTIVE_SHEETS} fichas ativas atingido` : 'Erro ao atualizar ficha')
    }
  }

  const handleDeleteSheet = async () => {
    try {
      await deleteSheet.mutateAsync(sheet.id)
      toast.success(`Ficha "${sheet.name}" removida`)
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { message?: string } } })?.response?.data
      toast.error(d?.message === 'HAS_HISTORY' ? `Não é possível excluir "${sheet.name}" pois possui histórico — desative em vez de excluir.` : 'Erro ao remover ficha')
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações da ficha */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{activeFieldCount} / {MAX_ACTIVE_FIELDS} campos ativos</p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEditSheet(sheet)}>
            <Pencil className="mr-1 h-3 w-3" /> Renomear
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleToggleSheet} disabled={updateMutation.isPending}>
            <Power className="mr-1 h-3 w-3" />{sheet.active ? 'Desativar' : 'Reativar'}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={handleDeleteSheet} disabled={deleteSheet.isPending}>
            <Trash2 className="mr-1 h-3 w-3" /> Excluir
          </Button>
        </div>
      </div>

      {/* â”€â”€ Seção COLUNAS (apenas fichas TABULAR) â”€â”€ */}
      {sheet.type === 'TABULAR' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Colunas</p>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => { setEditingColumn(undefined); setColumnDialogOpen(true) }}
              disabled={localColumns.length >= MAX_SHEET_COLUMNS}
            >
              <Plus className="mr-1 h-3 w-3" /> Coluna
            </Button>
          </div>
          {localColumns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">Nenhuma coluna. Adicione pelo menos uma para usar a ficha.</p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
              <SortableContext items={localColumns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="rounded-xl border divide-y overflow-hidden">
                  {localColumns.map((col) => (
                    <SortableColumnItem
                      key={col.id}
                      column={col}
                      deletePending={deleteColumn.isPending}
                      onEdit={() => { setEditingColumn(col); setColumnDialogOpen(true) }}
                      onDelete={() => handleDeleteColumn(col)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* â”€â”€ Seção CAMPOS (linhas) â”€â”€ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {sheet.type === 'TABULAR' ? 'Linhas (campos)' : 'Campos'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => { setEditingField(undefined); setFieldDialogOpen(true) }}
            disabled={activeFieldCount >= MAX_ACTIVE_FIELDS}
          >
            <Plus className="mr-1 h-3 w-3" /> Campo
          </Button>
        </div>

        {localFields.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">Nenhum campo configurado.</p>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
            <SortableContext items={localFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="rounded-xl border divide-y overflow-hidden">
                {localFields.map((field) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    sheetType={sheet.type}
                    reorderPending={reorderFields.isPending}
                    updatePending={updateField.isPending}
                    deletePending={deleteField.isPending}
                    onEdit={() => { setEditingField(field); setFieldDialogOpen(true) }}
                    onToggle={() => handleToggleField(field)}
                    onDelete={() => handleDeleteField(field)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Dialogs */}
      {fieldDialogOpen && (
        <FieldDialog
          open={fieldDialogOpen}
          sheetId={sheet.id}
          sheetType={sheet.type}
          field={editingField}
          nextOrder={editingField ? undefined : localFields.length}
          onClose={() => { setFieldDialogOpen(false); setEditingField(undefined) }}
        />
      )}
      {columnDialogOpen && (
        <ColumnDialog
          open={columnDialogOpen}
          sheetId={sheet.id}
          column={editingColumn}
          nextOrder={editingColumn ? undefined : localColumns.length}
          onClose={() => { setColumnDialogOpen(false); setEditingColumn(undefined) }}
        />
      )}
    </div>
  )
}

// â”€â”€ Item de ficha sortable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SortableSheetItem({
  sheet,
  isExpanded,
  onToggleExpand,
  onEditSheet,
}: {
  sheet: MeasurementSheet
  isExpanded: boolean
  onToggleExpand: () => void
  onEditSheet: (s: MeasurementSheet) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sheet.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={['rounded-xl border overflow-hidden', !sheet.active && 'opacity-60'].filter(Boolean).join(' ')}
    >
      <div className="w-full flex items-center gap-2 px-4 py-3 bg-card">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none" aria-label="Arrastar">
          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        </button>
        <button
          type="button"
          className="flex-1 flex items-center gap-3 text-left"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{sheet.name}</span>
            {sheetTypeBadge(sheet.type)}
            <span className="text-xs text-muted-foreground">
              ({sheet.fields.filter((f) => f.active).length} campos
              {sheet.type === 'TABULAR' && `, ${sheet.columns.length} colunas`})
            </span>
            {!sheet.active && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inativa</span>
            )}
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t px-4 py-4 bg-muted/20">
          <SheetPanel sheet={sheet} onEditSheet={onEditSheet} />
        </div>
      )}
    </div>
  )
}

// â”€â”€ Componente principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function BodyMeasurementsTab() {
  const { data: sheets = [], isLoading } = useMeasurementSheets({ includeInactive: true })
  const reorderSheets = useReorderMeasurementSheets()
  const [expandedSheetId, setExpandedSheetId] = useState<string | null>(null)
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false)
  const [editingSheet, setEditingSheet] = useState<MeasurementSheet | undefined>()

  const [localSheets, setLocalSheets] = useState(() => [...sheets].sort((a, b) => a.order - b.order))
  useEffect(() => { setLocalSheets([...sheets].sort((a, b) => a.order - b.order)) }, [sheets])

  const activeCount = sheets.filter((s) => s.active).length
  const atLimit = activeCount >= MAX_ACTIVE_SHEETS

  const handleSheetDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localSheets.findIndex((s) => s.id === active.id)
    const newIndex = localSheets.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const previous = localSheets
    const reordered = arrayMove(localSheets, oldIndex, newIndex)
    setLocalSheets(reordered)
    try { await reorderSheets.mutateAsync(reordered.map((s, i) => ({ id: s.id, order: i }))) }
    catch { setLocalSheets(previous); toast.error('Erro ao reordenar fichas') }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Fichas de avaliação</p>
          <p className="text-xs text-muted-foreground mt-0.5">{activeCount} / {MAX_ACTIVE_SHEETS} fichas ativas</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingSheet(undefined); setSheetDialogOpen(true) }}
          disabled={atLimit}
          title={atLimit ? `Limite de ${MAX_ACTIVE_SHEETS} fichas ativas atingido` : undefined}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Nova ficha
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : localSheets.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <Ruler className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhuma ficha de avaliação configurada.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setEditingSheet(undefined); setSheetDialogOpen(true) }}>
            Criar primeira ficha
          </Button>
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleSheetDragEnd}>
          <SortableContext items={localSheets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {localSheets.map((sheet) => (
                <SortableSheetItem
                  key={sheet.id}
                  sheet={sheet}
                  isExpanded={expandedSheetId === sheet.id}
                  onToggleExpand={() => setExpandedSheetId(expandedSheetId === sheet.id ? null : sheet.id)}
                  onEditSheet={(s) => { setEditingSheet(s); setSheetDialogOpen(true) }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {sheetDialogOpen && (
        <SheetDialog
          open={sheetDialogOpen}
          sheet={editingSheet}
          onClose={() => { setSheetDialogOpen(false); setEditingSheet(undefined) }}
        />
      )}
    </div>
  )
}

