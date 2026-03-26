'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Power,
  Ruler,
  Trash2,
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
import { useForm, useFieldArray } from 'react-hook-form'
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
  useCreateSubColumn,
  type MeasurementSheet,
  type MeasurementField,
  type MeasurementFieldType,
} from '@/lib/hooks/use-measurement-sheets'

const MAX_ACTIVE_SHEETS = 20
const MAX_ACTIVE_FIELDS = 30

// ── Schemas ───────────────────────────────────────────────────────────────────

const sheetSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
})
type SheetForm = z.infer<typeof sheetSchema>

const subColumnSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  unit: z.string().min(1, 'Unidade obrigatória').max(20),
})

const fieldSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SIMPLE'),
    name: z.string().min(1, 'Nome obrigatório').max(100),
    unit: z.string().min(1, 'Unidade obrigatória para campo simples').max(20),
    subColumns: z.array(subColumnSchema).optional(),
  }),
  z.object({
    type: z.literal('TABULAR'),
    name: z.string().min(1, 'Nome obrigatório').max(100),
    unit: z.string().optional(),
    subColumns: z.array(subColumnSchema).min(1, 'Adicione ao menos uma sub-coluna').max(10),
  }),
  z.object({
    type: z.literal('CHECK'),
    name: z.string().min(1, 'Nome obrigatório').max(100),
    unit: z.string().optional(),
    subColumns: z.array(subColumnSchema).optional(),
  }),
])
type FieldForm = z.infer<typeof fieldSchema>

// ── Utilitários ───────────────────────────────────────────────────────────────

function fieldTypeBadge(type: MeasurementFieldType) {
  if (type === 'SIMPLE')
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
        Simples
      </span>
    )
  if (type === 'CHECK')
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Marcação
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
      Tabular
    </span>
  )
}

// ── Dialog de Ficha ───────────────────────────────────────────────────────────

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
    formState: { errors, isDirty },
  } = useForm<SheetForm>({
    resolver: zodResolver(sheetSchema),
    defaultValues: { name: sheet?.name ?? '' },
  })

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (sheet) {
        await updateMutation.mutateAsync({ id: sheet.id, ...data })
        toast.success('Ficha atualizada com sucesso')
      } else {
        await createMutation.mutateAsync(data)
        toast.success('Ficha criada com sucesso')
      }
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'MAX_SHEETS_REACHED') {
        toast.error(`Limite de ${MAX_ACTIVE_SHEETS} fichas ativas atingido`)
      } else if (code === 'CONFLICT') {
        toast.error('Já existe uma ficha com este nome')
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
          <Input id="sheet-name" {...register('name')} placeholder="Ex: Perimetria, Dobras Cutâneas" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
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

// ── Dialog de Campo ───────────────────────────────────────────────────────────

type FieldPrefill = {
  type: MeasurementFieldType
  unit?: string
  subColumns?: Array<{ name: string; unit: string }>
}

function FieldDialog({
  open,
  sheetId,
  field,
  prefill,
  onClose,
}: {
  open: boolean
  sheetId: string
  field?: MeasurementField
  prefill?: FieldPrefill
  onClose: () => void
}) {
  const createField = useCreateMeasurementField(sheetId)
  const updateField = useUpdateMeasurementField()
  const createSubColumn = useCreateSubColumn()
  const isPending = createField.isPending || updateField.isPending || createSubColumn.isPending

  const defaultValues = field
    ? {
        type: field.type,
        name: field.name,
        unit: field.unit ?? '',
        subColumns: field.columns.map((c) => ({ name: c.name, unit: c.unit })),
      }
    : prefill
    ? { type: prefill.type, name: '', unit: prefill.unit ?? '', subColumns: prefill.subColumns ?? [] }
    : { type: 'SIMPLE' as MeasurementFieldType, name: '', unit: '', subColumns: [] }

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isDirty },
  } = useForm<FieldForm>({
    resolver: zodResolver(fieldSchema),
    defaultValues,
  })

  const { fields: subCols, append, remove } = useFieldArray({ control, name: 'subColumns' as never })
  const fieldType = watch('type') as MeasurementFieldType

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (field) {
        await updateField.mutateAsync({
          sheetId,
          fieldId: field.id,
          name: data.name,
          unit: data.type === 'SIMPLE' ? data.unit : undefined,
        })
        toast.success('Campo atualizado')
      } else {
        const created = await createField.mutateAsync({
          type: data.type,
          name: data.name,
          unit: data.type === 'SIMPLE' ? data.unit : undefined,
        })
        // Criar sub-colunas em sequência para TABULAR
        if (data.type === 'TABULAR' && data.subColumns?.length) {
          for (let i = 0; i < data.subColumns.length; i++) {
            await createSubColumn.mutateAsync({
              sheetId,
              fieldId: created.id,
              name: data.subColumns[i].name,
              unit: data.subColumns[i].unit,
              order: i,
            })
          }
        }
        toast.success('Campo criado com sucesso')
      }
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'MAX_FIELDS_REACHED') {
        toast.error(`Limite de ${MAX_ACTIVE_FIELDS} campos ativos atingido`)
      } else if (code === 'CONFLICT') {
        toast.error('Já existe um campo com este nome na ficha')
      } else {
        toast.error('Erro ao salvar campo')
      }
    }
  })

  return (
    <Dialog open={open} onClose={onClose} isDirty={isDirty} className="max-w-lg">
      <DialogTitle>{field ? 'Editar campo' : 'Novo campo'}</DialogTitle>
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Nome */}
        <div className="space-y-1.5">
          <Label htmlFor="field-name">Nome *</Label>
          <Input id="field-name" {...register('name')} placeholder="Ex: Peso, Cintura, FEG" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Tipo */}
        {!field && (
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <div className="flex gap-2">
              {(['SIMPLE', 'TABULAR', 'CHECK'] as MeasurementFieldType[]).map((t) => {
                const label = t === 'SIMPLE' ? 'Simples' : t === 'TABULAR' ? 'Tabular' : 'Marcação (Sim/Não)'
                return (
                  <label
                    key={t}
                    className={[
                      'flex-1 cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm transition-colors',
                      fieldType === t
                        ? 'border-primary bg-primary/5 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    ].join(' ')}
                  >
                    <input type="radio" value={t} {...register('type')} className="sr-only" />
                    {label}
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Unidade — somente para SIMPLE */}
        {fieldType === 'SIMPLE' && (
          <div className="space-y-1.5">
            <Label htmlFor="field-unit">Unidade *</Label>
            <Input id="field-unit" {...register('unit')} placeholder="Ex: kg, cm, %, mm" />
            {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
          </div>
        )}

        {/* CHECK: sem unidade, sem sub-colunas */}
        {fieldType === 'CHECK' && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
            Campo de marcação — apenas Sim / Não. Sem unidade ou sub-colunas.
          </p>
        )}

        {/* Sub-colunas — somente para TABULAR em modo criação */}
        {field && field.type === 'TABULAR' && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
            Sub-colunas não podem ser editadas após a criação do campo. Para alterar a estrutura, crie um novo campo.
          </p>
        )}
        {fieldType === 'TABULAR' && !field && (
          <div className="space-y-2">
            <Label>Sub-colunas *</Label>
            <p className="text-xs text-muted-foreground -mt-1">Cada sub-coluna representa uma medida dentro do campo tabular.</p>
            {(subCols as Array<{ id: string }>).map((sc, idx) => (
              <div key={sc.id} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="Nome da coluna"
                    {...register(`subColumns.${idx}.name` as const)}
                  />
                  {'subColumns' in errors && (errors as { subColumns?: { [key: number]: { name?: { message?: string } } } }).subColumns?.[idx]?.name && (
                    <p className="text-xs text-destructive">
                      {(errors as { subColumns?: { [key: number]: { name?: { message?: string } } } }).subColumns?.[idx]?.name?.message}
                    </p>
                  )}
                </div>
                <div className="w-24 space-y-1">
                  <Input
                    placeholder="Unidade"
                    {...register(`subColumns.${idx}.unit` as const)}
                  />
                  {'subColumns' in errors && (errors as { subColumns?: { [key: number]: { unit?: { message?: string } } } }).subColumns?.[idx]?.unit && (
                    <p className="text-xs text-destructive">
                      {(errors as { subColumns?: { [key: number]: { unit?: { message?: string } } } }).subColumns?.[idx]?.unit?.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 mt-0.5"
                  onClick={() => remove(idx)}
                  aria-label="Remover sub-coluna"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: '', unit: '' })}
              disabled={(subCols as Array<unknown>).length >= 10}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Sub-coluna
            </Button>
            {'subColumns' in errors && typeof errors.subColumns?.message === 'string' && (
              <p className="text-xs text-destructive">{errors.subColumns.message}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending || !isDirty}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {field ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ── Item de campo ordenável via DnD ─────────────────────────────────────────

function SortableFieldItem({
  field,
  reorderPending,
  updatePending,
  deletePending,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
}: {
  field: MeasurementField
  reorderPending: boolean
  updatePending: boolean
  deletePending: boolean
  onEdit: () => void
  onDuplicate: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-2 px-3 py-2.5 bg-card text-sm',
        !field.active && 'opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Arrastar para reordenar"
        disabled={reorderPending}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40" aria-hidden />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{field.name}</span>
          {fieldTypeBadge(field.type)}
          {field.unit && (
            <span className="text-xs text-muted-foreground">{field.unit}</span>
          )}
          {/* B-03: Badge Inativo visível mesmo com opacity-50 */}
          {!field.active && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Inativo
            </span>
          )}
        </div>
        {field.type === 'TABULAR' && field.columns.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {field.columns.map((c) => `${c.name} (${c.unit})`).join(' · ')}
          </p>
        )}
      </div>

      <div className="flex gap-0.5 shrink-0">
        {/* M-02: Duplicar campo */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onDuplicate}
          aria-label="Duplicar campo"
          title="Duplicar (pré-preenche novo campo)"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onEdit}
          aria-label="Editar campo"
          title="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onToggle}
          disabled={updatePending}
          aria-label={field.active ? 'Desativar campo' : 'Reativar campo'}
          title={field.active ? 'Desativar' : 'Reativar'}
        >
          <Power className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onDelete}
          disabled={deletePending}
          aria-label="Excluir campo"
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// ── Painel inline de uma Ficha ────────────────────────────────────────────────

function SheetPanel({
  sheet,
  onEditSheet,
}: {
  sheet: MeasurementSheet
  onEditSheet: (sheet: MeasurementSheet) => void
}) {
  const updateMutation = useUpdateMeasurementSheet()
  const deleteSheet = useDeleteMeasurementSheet()
  const updateField = useUpdateMeasurementField()
  const deleteField = useDeleteMeasurementField()
  const reorderFields = useReorderMeasurementFields()

  const [fieldDialogOpen, setFieldDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<MeasurementField | undefined>()
  const [fieldPrefill, setFieldPrefill] = useState<FieldPrefill | undefined>()

  const sortedFields = [...sheet.fields].sort((a, b) => a.order - b.order)
  const activeFieldCount = sortedFields.filter((f) => f.active).length

  const handleToggleField = async (field: MeasurementField) => {
    try {
      await updateField.mutateAsync({
        sheetId: sheet.id,
        fieldId: field.id,
        active: !field.active,
      })
      toast.success(field.active ? `Campo "${field.name}" desativado` : `Campo "${field.name}" reativado`)
    } catch {
      toast.error('Erro ao atualizar campo')
    }
  }

  const handleDeleteField = async (field: MeasurementField) => {
    try {
      await deleteField.mutateAsync({ sheetId: sheet.id, fieldId: field.id })
      toast.success(`Campo "${field.name}" removido`)
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'HAS_HISTORY') {
        toast.error('Não é possível excluir: campo possui histórico de valores. Desative em vez disso.')
      } else {
        toast.error('Erro ao remover campo')
      }
    }
  }

  // B-04: Reordenação por DnD
  const handleFieldDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedFields.findIndex((f) => f.id === active.id)
    const newIndex = sortedFields.findIndex((f) => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sortedFields, oldIndex, newIndex)
    const payload = reordered.map((f, i) => ({ id: f.id, order: i }))
    try {
      await reorderFields.mutateAsync({ sheetId: sheet.id, fields: payload })
    } catch {
      toast.error('Erro ao reordenar campos')
    }
  }

  const handleToggleSheet = async () => {
    try {
      await updateMutation.mutateAsync({ id: sheet.id, active: !sheet.active })
      toast.success(sheet.active ? 'Ficha desativada' : 'Ficha reativada')
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'MAX_SHEETS_REACHED') {
        toast.error(`Limite de ${MAX_ACTIVE_SHEETS} fichas ativas atingido`)
      } else {
        toast.error('Erro ao atualizar ficha')
      }
    }
  }

  const handleDeleteSheet = async () => {
    try {
      await deleteSheet.mutateAsync(sheet.id)
      toast.success(`Ficha "${sheet.name}" removida`)
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'HAS_HISTORY') {
        toast.error('Não é possível excluir: ficha possui histórico de registros. Desative em vez disso.')
      } else {
        toast.error('Erro ao remover ficha')
      }
    }
  }

  // M-02: Abrir diálogo com pre-preenchimento do último campo
  const openAddFieldDialog = (prefill?: FieldPrefill) => {
    setEditingField(undefined)
    setFieldPrefill(prefill)
    setFieldDialogOpen(true)
  }

  return (
    <div className="space-y-3">
      {/* Barra de ações da ficha */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {activeFieldCount} / {MAX_ACTIVE_FIELDS} campos ativos
        </p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onEditSheet(sheet)}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Renomear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleToggleSheet}
            disabled={updateMutation.isPending}
          >
            <Power className="mr-1 h-3 w-3" />
            {sheet.active ? 'Desativar' : 'Reativar'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={handleDeleteSheet}
            disabled={deleteSheet.isPending}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Lista de campos com DnD (B-04) */}
      {sortedFields.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum campo. Adicione o primeiro abaixo.</p>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
          <SortableContext items={sortedFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="rounded-xl border divide-y overflow-hidden">
              {sortedFields.map((field) => (
                <SortableFieldItem
                  key={field.id}
                  field={field}
                  reorderPending={reorderFields.isPending}
                  updatePending={updateField.isPending}
                  deletePending={deleteField.isPending}
                  onEdit={() => { setEditingField(field); setFieldPrefill(undefined); setFieldDialogOpen(true) }}
                  onDuplicate={() =>
                    openAddFieldDialog({
                      type: field.type,
                      unit: field.unit ?? undefined,
                      subColumns: field.columns.map((c) => ({ name: c.name, unit: c.unit })),
                    })
                  }
                  onToggle={() => handleToggleField(field)}
                  onDelete={() => handleDeleteField(field)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* M-02: Botão "Adicionar campo" pré-preenche com último campo */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const last = sortedFields[sortedFields.length - 1]
          openAddFieldDialog(
            last
              ? {
                  type: last.type,
                  unit: last.unit ?? undefined,
                  subColumns: last.columns.map((c) => ({ name: c.name, unit: c.unit })),
                }
              : undefined
          )
        }}
        disabled={activeFieldCount >= MAX_ACTIVE_FIELDS}
        title={activeFieldCount >= MAX_ACTIVE_FIELDS ? `Limite de ${MAX_ACTIVE_FIELDS} campos atingido` : undefined}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Adicionar campo
      </Button>

      {fieldDialogOpen && (
        <FieldDialog
          open={fieldDialogOpen}
          sheetId={sheet.id}
          field={editingField}
          prefill={editingField ? undefined : fieldPrefill}
          onClose={() => { setFieldDialogOpen(false); setEditingField(undefined); setFieldPrefill(undefined) }}
        />
      )}
    </div>
  )
}

// ── Item de ficha ordenável via DnD ─────────────────────────────────────────

function SortableSheetItem({
  sheet,
  isExpanded,
  onToggleExpand,
  onEditSheet,
}: {
  sheet: MeasurementSheet
  isExpanded: boolean
  onToggleExpand: () => void
  onEditSheet: (sheet: MeasurementSheet) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sheet.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'rounded-xl border overflow-hidden',
        !sheet.active && 'opacity-60',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Cabeçalho da ficha */}
      <div className="w-full flex items-center gap-2 px-4 py-3 bg-card">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
          aria-label="Arrastar para reordenar ficha"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/40" aria-hidden />
        </button>
        <button
          type="button"
          className="flex-1 flex items-center gap-3 text-left hover:bg-transparent transition-colors"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{sheet.name}</span>
              <span className="text-xs text-muted-foreground">
                ({sheet.fields.filter((f) => f.active).length} campos)
              </span>
              {!sheet.active && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Inativa
                </span>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Painel inline */}
      {isExpanded && (
        <div className="border-t px-4 py-4 bg-muted/20">
          <SheetPanel
            sheet={sheet}
            onEditSheet={onEditSheet}
          />
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export function BodyMeasurementsTab() {
  const { data: sheets = [], isLoading } = useMeasurementSheets({ includeInactive: true })
  const reorderSheets = useReorderMeasurementSheets()
  const [expandedSheetId, setExpandedSheetId] = useState<string | null>(null)
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false)
  const [editingSheet, setEditingSheet] = useState<MeasurementSheet | undefined>()

  const activeCount = sheets.filter((s) => s.active).length
  const atLimit = activeCount >= MAX_ACTIVE_SHEETS

  const sortedSheets = [...sheets].sort((a, b) => a.order - b.order)

  // M-03: Reordenação de fichas por DnD
  const handleSheetDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedSheets.findIndex((s) => s.id === active.id)
    const newIndex = sortedSheets.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sortedSheets, oldIndex, newIndex)
    const payload = reordered.map((s, i) => ({ id: s.id, order: i }))
    try {
      await reorderSheets.mutateAsync(payload)
    } catch {
      toast.error('Erro ao reordenar fichas')
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Fichas de avaliação</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeCount} / {MAX_ACTIVE_SHEETS} fichas ativas
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingSheet(undefined); setSheetDialogOpen(true) }}
          disabled={atLimit}
          title={atLimit ? `Limite de ${MAX_ACTIVE_SHEETS} fichas ativas atingido` : undefined}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Nova ficha
        </Button>
      </div>

      {/* Lista de fichas */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sortedSheets.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <Ruler className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhuma ficha de avaliação configurada.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => { setEditingSheet(undefined); setSheetDialogOpen(true) }}
          >
            Criar primeira ficha
          </Button>
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleSheetDragEnd}>
          <SortableContext items={sortedSheets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedSheets.map((sheet) => (
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

      {/* Dialog de ficha */}
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
