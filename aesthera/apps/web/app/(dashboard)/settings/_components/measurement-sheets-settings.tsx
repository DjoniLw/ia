'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  GripVertical,
  Plus,
  Loader2,
  ClipboardList,
  LibraryBig,
  ChevronDown,
  ChevronUp,
  List,
  Table2,
  Trash2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Pencil,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
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
  type MeasurementSheet,
  type MeasurementField,
  type MeasurementSheetType,
  type MeasurementInputType,
  type MeasurementCategory,
} from '@/lib/hooks/use-measurement-sheets'
import {
  CATEGORY_LABELS,
  SHEET_TYPE_LABELS,
  MEASUREMENT_CATEGORIES_ORDER,
  CATEGORY_ICON,
  SHEET_TYPE_BADGE_COLOR,
  FIELD_INPUT_TYPE_BADGE_COLOR,
} from '@/lib/measurement-categories'
import { MeasurementTemplatesDrawer } from './measurement-templates-drawer'
import { cn } from '@/lib/utils'

const MAX_ACTIVE_SHEETS = 20

function SortableSheetItem({
  sheet,
  selected,
  onSelect,
  isReadonly,
}: {
  sheet: MeasurementSheet
  selected: boolean
  onSelect: () => void
  isReadonly: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: sheet.id,
    disabled: isReadonly,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 text-sm transition-colors cursor-pointer hover:bg-muted/50',
        selected && 'bg-primary/5',
      )}
    >
      {!isReadonly && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing shrink-0 touch-none focus:outline-none"
          aria-label="Reordenar"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate block">{sheet.name}</span>
      </div>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
          SHEET_TYPE_BADGE_COLOR[sheet.type],
        )}
      >
        {sheet.type === 'TABULAR' ? (
          <Table2 className="h-3 w-3" />
        ) : (
          <List className="h-3 w-3" />
        )}
        {SHEET_TYPE_LABELS[sheet.type]}
      </span>
    </div>
  )
}

function NewSheetDialog({
  category,
  onClose,
  onCreated,
}: {
  category: MeasurementCategory
  onClose: () => void
  onCreated: (sheetId: string) => void
}) {
  const createSheet = useCreateMeasurementSheet()
  const [name, setName] = useState('')
  const [type, setType] = useState<MeasurementSheetType>('SIMPLE')
  const [nameError, setNameError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Nome obrigatório')
      return
    }
    try {
      const sheet = await createSheet.mutateAsync({
        name: name.trim(),
        type,
        category,
        scope: 'SYSTEM',
      })
      toast.success('Ficha criada')
      onCreated(sheet.id)
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { error?: string; message?: string } } })?.response
        ?.data
      if (d?.error === 'CONFLICT') toast.error('Já existe uma ficha com este nome')
      else if (d?.message === 'MAX_SHEETS_REACHED')
        toast.error(`Limite de ${MAX_ACTIVE_SHEETS} fichas ativas atingido`)
      else toast.error('Erro ao criar ficha')
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-sm">
      <DialogTitle>Nova ficha — {CATEGORY_LABELS[category]}</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-sheet-name">Nome *</Label>
          <Input
            id="new-sheet-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError('')
            }}
            placeholder="Ex: Perimetria, Plicometria"
            autoFocus
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        <div className="space-y-2">
          <Label>Formato *</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['SIMPLE', 'TABULAR'] as MeasurementSheetType[]).map((t) => (
              <label
                key={t}
                className={cn(
                  'cursor-pointer rounded-lg border p-3 transition-colors',
                  type === t
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <input
                  type="radio"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                <div className="flex items-center gap-2 mb-1">
                  {t === 'SIMPLE' ? (
                    <List className="h-4 w-4" />
                  ) : (
                    <Table2 className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">{SHEET_TYPE_LABELS[t]}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {t === 'SIMPLE'
                    ? 'Lista de campos. Cada campo pode ser digitação ou marcação.'
                    : 'Tabela: linhas são os campos, colunas são definidas por você.'}
                </p>
              </label>
            ))}
          </div>
        </div>

        {type === 'TABULAR' && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
            Exemplo: Perimetria com colunas Esq., Dir. — e linhas Braço, Pescoço, Cintura.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={createSheet.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={createSheet.isPending || !name.trim()}
          >
            {createSheet.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Criar
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function SimpleSheetEditor({
  sheet,
  isReadonly,
}: {
  sheet: MeasurementSheet
  isReadonly: boolean
}) {
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newInputType, setNewInputType] = useState<MeasurementInputType>('INPUT')
  const editInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const updateField = useUpdateMeasurementField()
  const createField = useCreateMeasurementField(sheet.id)
  const deleteField = useDeleteMeasurementField()
  const reorderFields = useReorderMeasurementFields()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeFields = [...(sheet.fields ?? [])]
    .filter((f) => f.active)
    .sort((a, b) => a.order - b.order)

  useEffect(() => {
    if (editingFieldId) editInputRef.current?.focus()
  }, [editingFieldId])

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus()
  }, [isAdding])

  function startEdit(field: MeasurementField) {
    setEditingFieldId(field.id)
    setEditName(field.name)
    setEditUnit(field.unit ?? '')
  }

  async function confirmEdit(fieldId: string) {
    const field = sheet.fields.find((f) => f.id === fieldId)
    if (!field || !editName.trim()) return
    try {
      await updateField.mutateAsync({
        sheetId: sheet.id,
        fieldId,
        name: editName.trim(),
        unit:
          field.inputType === 'INPUT' && !field.isTextual ? editUnit.trim() || undefined : undefined,
      })
      setEditingFieldId(null)
    } catch {
      toast.error('Erro ao atualizar campo')
    }
  }

  function cancelEdit() {
    setEditingFieldId(null)
    setEditName('')
    setEditUnit('')
  }

  async function toggleDirEsq(field: MeasurementField) {
    const hasDirEsq = field.subColumns?.includes('Direito')
    try {
      await updateField.mutateAsync({
        sheetId: sheet.id,
        fieldId: field.id,
        subColumns: hasDirEsq ? [] : ['Direito', 'Esquerdo'],
      })
    } catch {
      toast.error('Erro ao atualizar campo')
    }
  }

  async function handleDelete(fieldId: string) {
    try {
      await deleteField.mutateAsync({ sheetId: sheet.id, fieldId })
    } catch {
      toast.error('Erro ao remover campo')
    }
  }

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await createField.mutateAsync({
        name: newName.trim(),
        inputType: newInputType,
        order: activeFields.length + 1,
      })
      setNewName('')
      setIsAdding(false)
    } catch {
      toast.error('Erro ao criar campo')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = activeFields.findIndex((f) => f.id === active.id)
    const newIdx = activeFields.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(activeFields, oldIdx, newIdx)
    reorderFields.mutate({
      sheetId: sheet.id,
      fields: reordered.map((f, i) => ({ id: f.id, order: i + 1 })),
    })
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={activeFields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          {activeFields.map((field, idx) => (
            <SortableFieldRow
              key={field.id}
              field={field}
              isEditing={editingFieldId === field.id}
              editName={editName}
              editUnit={editUnit}
              editInputRef={editingFieldId === field.id ? editInputRef : undefined}
              isReadonly={isReadonly}
              onStartEdit={() => startEdit(field)}
              onConfirmEdit={() => confirmEdit(field.id)}
              onCancelEdit={cancelEdit}
              onEditNameChange={setEditName}
              onEditUnitChange={setEditUnit}
              onToggleDirEsq={() => toggleDirEsq(field)}
              onDelete={() => handleDelete(field.id)}
              onMoveUp={
                idx > 0
                  ? () => {
                      const reordered = arrayMove(activeFields, idx, idx - 1)
                      reorderFields.mutate({
                        sheetId: sheet.id,
                        fields: reordered.map((f, i) => ({ id: f.id, order: i + 1 })),
                      })
                    }
                  : undefined
              }
              onMoveDown={
                idx < activeFields.length - 1
                  ? () => {
                      const reordered = arrayMove(activeFields, idx, idx + 1)
                      reorderFields.mutate({
                        sheetId: sheet.id,
                        fields: reordered.map((f, i) => ({ id: f.id, order: i + 1 })),
                      })
                    }
                  : undefined
              }
            />
          ))}
        </SortableContext>
      </DndContext>

      {!isReadonly && (
        <>
          {isAdding ? (
            <form
              onSubmit={handleAddField}
              className="rounded-lg border bg-muted/30 p-3 space-y-2"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do campo *</Label>
                <Input
                  ref={addInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Peso, Altura, IMC"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsAdding(false)
                      setNewName('')
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                {(['INPUT', 'CHECK'] as MeasurementInputType[]).map((t) => (
                  <label
                    key={t}
                    className={cn(
                      'flex-1 cursor-pointer rounded border px-2 py-1.5 text-center text-xs transition-colors',
                      newInputType === t
                        ? 'border-primary bg-primary/5 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    <input
                      type="radio"
                      value={t}
                      checked={newInputType === t}
                      onChange={() => setNewInputType(t)}
                      className="sr-only"
                    />
                    {t === 'INPUT' ? 'Digitação' : 'Marcação'}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="h-7 text-xs" disabled={!newName.trim() || createField.isPending}>
                  {createField.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Adicionar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setIsAdding(false); setNewName('') }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground h-8 text-xs"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar campo
            </Button>
          )}
        </>
      )}

      {activeFields.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum campo cadastrado</p>
      )}
    </div>
  )
}

function SortableFieldRow({
  field,
  isEditing,
  editName,
  editUnit,
  editInputRef,
  isReadonly,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onEditNameChange,
  onEditUnitChange,
  onToggleDirEsq,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  field: MeasurementField
  isEditing: boolean
  editName: string
  editUnit: string
  editInputRef?: React.RefObject<HTMLInputElement | null>
  isReadonly: boolean
  onStartEdit: () => void
  onConfirmEdit: () => void
  onCancelEdit: () => void
  onEditNameChange: (v: string) => void
  onEditUnitChange: (v: string) => void
  onToggleDirEsq: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
    disabled: isReadonly,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const hasDirEsq = field.subColumns?.includes('Direito')
  const isNumericInput = field.inputType === 'INPUT' && !field.isTextual

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card px-3 py-2 text-sm"
    >
      {isEditing ? (
        <div className="space-y-2">
          <Input
            ref={editInputRef}
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            className="h-7 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onConfirmEdit() }
              if (e.key === 'Escape') onCancelEdit()
              if (e.key === 'Tab') { e.preventDefault(); onConfirmEdit() }
            }}
          />
          {isNumericInput && (
            <Input
              value={editUnit}
              onChange={(e) => onEditUnitChange(e.target.value)}
              placeholder="Unidade (opcional)"
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onConfirmEdit() }
                if (e.key === 'Escape') onCancelEdit()
              }}
            />
          )}
          <div className="flex gap-1">
            <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={onConfirmEdit}>
              <Check className="h-3 w-3 mr-0.5" />
              Salvar
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onCancelEdit}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {!isReadonly && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing shrink-0 touch-none focus:outline-none"
              aria-label="Arrastar"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40" />
            </button>
          )}
          {!isReadonly && (
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!onMoveUp}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                aria-label="Mover para cima"
              >
                <ArrowUp className="h-3 w-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!onMoveDown}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                aria-label="Mover para baixo"
              >
                <ArrowDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
          <div
            className={cn('flex-1 min-w-0 flex items-center gap-2', !isReadonly && 'cursor-pointer')}
            onClick={!isReadonly ? onStartEdit : undefined}
          >
            <span className="font-medium truncate">{field.name}</span>
            <span
              className={cn(
                'inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium shrink-0',
                FIELD_INPUT_TYPE_BADGE_COLOR[field.inputType],
              )}
            >
              {field.inputType === 'INPUT' ? 'Digitação' : 'Marcação'}
            </span>
            {field.unit && (
              <span className="text-xs text-muted-foreground shrink-0">{field.unit}</span>
            )}
          </div>
          {!isReadonly && isNumericInput && (
            <button
              type="button"
              onClick={onToggleDirEsq}
              className={cn(
                'shrink-0 rounded border px-1.5 py-0.5 text-xs transition-colors whitespace-nowrap',
                hasDirEsq
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
              title={hasDirEsq ? 'Desativar split Direito/Esquerdo' : 'Ativar split Direito/Esquerdo'}
              aria-label={hasDirEsq ? 'Desativar Direito/Esquerdo' : 'Ativar Direito/Esquerdo'}
            >
              Direito/Esquerdo
            </button>
          )}
          {!isReadonly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label="Remover campo"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function TabularSheetEditor({
  sheet,
  isReadonly,
}: {
  sheet: MeasurementSheet
  isReadonly: boolean
}) {
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editColName, setEditColName] = useState('')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editRowName, setEditRowName] = useState('')
  const [editRowDefaultValue, setEditRowDefaultValue] = useState('')
  const [isAddingCol, setIsAddingCol] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [isAddingRow, setIsAddingRow] = useState(false)
  const [newRowName, setNewRowName] = useState('')
  const colEditRef = useRef<HTMLInputElement>(null)
  const rowEditRef = useRef<HTMLInputElement>(null)

  const createField = useCreateMeasurementField(sheet.id)
  const updateField = useUpdateMeasurementField()
  const deleteField = useDeleteMeasurementField()
  const reorderFields = useReorderMeasurementFields()
  const createColumn = useCreateSheetColumn()
  const updateColumn = useUpdateSheetColumn()
  const deleteColumn = useDeleteSheetColumn()

  const rowSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const activeFields = [...(sheet.fields ?? [])]
    .filter((f) => f.active)
    .sort((a, b) => a.order - b.order)
  const columns = [...(sheet.columns ?? [])].sort((a, b) => a.order - b.order)

  useEffect(() => {
    if (editingColId) colEditRef.current?.focus()
  }, [editingColId])

  useEffect(() => {
    if (editingRowId) rowEditRef.current?.focus()
  }, [editingRowId])

  async function confirmColEdit(colId: string) {
    if (!editColName.trim()) return
    try {
      await updateColumn.mutateAsync({ sheetId: sheet.id, colId, name: editColName.trim() })
      setEditingColId(null)
    } catch { toast.error('Erro ao atualizar coluna') }
  }

  async function handleDeleteCol(colId: string) {
    try {
      await deleteColumn.mutateAsync({ sheetId: sheet.id, colId })
    } catch { toast.error('Erro ao remover coluna') }
  }

  async function handleAddCol(e: React.FormEvent) {
    e.preventDefault()
    if (!newColName.trim()) return
    try {
      await createColumn.mutateAsync({
        sheetId: sheet.id,
        name: newColName.trim(),
        inputType: 'INPUT',
        order: columns.length + 1,
      })
      setNewColName('')
      setIsAddingCol(false)
    } catch { toast.error('Erro ao criar coluna') }
  }

  async function confirmRowEdit(fieldId: string) {
    if (!editRowName.trim()) return
    try {
      await updateField.mutateAsync({
        sheetId: sheet.id,
        fieldId,
        name: editRowName.trim(),
        defaultValue: editRowDefaultValue.trim() || null,
      })
      setEditingRowId(null)
    } catch { toast.error('Erro ao atualizar campo') }
  }

  async function handleDeleteRow(fieldId: string) {
    try {
      await deleteField.mutateAsync({ sheetId: sheet.id, fieldId })
    } catch { toast.error('Erro ao remover campo') }
  }

  async function handleAddRow(e: React.FormEvent) {
    e.preventDefault()
    if (!newRowName.trim()) return
    try {
      await createField.mutateAsync({
        name: newRowName.trim(),
        inputType: 'INPUT',
        order: activeFields.length + 1,
      })
      setNewRowName('')
      setIsAddingRow(false)
    } catch { toast.error('Erro ao criar campo') }
  }

  function handleRowDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = activeFields.findIndex((f) => f.id === active.id)
    const newIdx = activeFields.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(activeFields, oldIdx, newIdx)
    reorderFields.mutate({
      sheetId: sheet.id,
      fields: reordered.map((f, i) => ({ id: f.id, order: i + 1 })),
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Colunas</p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((col) => (
            <div key={col.id} className="group inline-flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1.5">
              {!isReadonly && editingColId === col.id ? (
                <input
                  ref={colEditRef}
                  value={editColName}
                  onChange={(e) => setEditColName(e.target.value)}
                  className="w-24 text-xs border-none bg-transparent focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void confirmColEdit(col.id) }
                    if (e.key === 'Escape') setEditingColId(null)
                  }}
                  onBlur={() => void confirmColEdit(col.id)}
                />
              ) : (
                <span
                  className={cn('text-xs font-medium', !isReadonly && 'cursor-pointer hover:text-primary')}
                  onClick={!isReadonly ? () => { setEditingColId(col.id); setEditColName(col.name) } : undefined}
                >
                  {col.name}
                </span>
              )}
              {!isReadonly && editingColId !== col.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteCol(col.id)}
                  className="ml-0.5 hidden group-hover:flex items-center text-muted-foreground hover:text-destructive"
                  aria-label="Remover coluna"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {!isReadonly && (
            <>
              {isAddingCol ? (
                <form onSubmit={handleAddCol} className="inline-flex items-center gap-1">
                  <Input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Nome da coluna" className="h-7 w-32 text-xs" autoFocus onKeyDown={(e) => { if (e.key === 'Escape') { setIsAddingCol(false); setNewColName('') } }} />
                  <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={!newColName.trim()}><Check className="h-3 w-3" /></Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setIsAddingCol(false); setNewColName('') }}><X className="h-3 w-3" /></Button>
                </form>
              ) : (
                <button type="button" onClick={() => setIsAddingCol(true)} className="inline-flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-solid transition-colors">
                  <Plus className="h-3 w-3" />
                  Nova coluna
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Campos (linhas)</p>
        <DndContext sensors={rowSensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
          <SortableContext items={activeFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {activeFields.map((field) => (
                <SortableTabularRow
                  key={field.id}
                  field={field}
                  isEditing={editingRowId === field.id}
                  editName={editRowName}
                  editDefaultValue={editRowDefaultValue}
                  editRef={editingRowId === field.id ? rowEditRef : undefined}
                  isReadonly={isReadonly}
                  onStartEdit={() => { setEditingRowId(field.id); setEditRowName(field.name); setEditRowDefaultValue(field.defaultValue ?? '') }}
                  onConfirm={() => confirmRowEdit(field.id)}
                  onCancel={() => setEditingRowId(null)}
                  onNameChange={setEditRowName}
                  onDefaultValueChange={setEditRowDefaultValue}
                  onDelete={() => handleDeleteRow(field.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {!isReadonly && (
          <>
            {isAddingRow ? (
              <form onSubmit={handleAddRow} className="mt-1 flex items-center gap-2">
                <Input value={newRowName} onChange={(e) => setNewRowName(e.target.value)} placeholder="Nome do campo" className="h-7 text-sm flex-1" autoFocus onKeyDown={(e) => { if (e.key === 'Escape') { setIsAddingRow(false); setNewRowName('') } }} />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={!newRowName.trim()}><Check className="h-3 w-3" /></Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setIsAddingRow(false); setNewRowName('') }}><X className="h-3 w-3" /></Button>
              </form>
            ) : (
              <button type="button" onClick={() => setIsAddingRow(true)} className="mt-1 flex items-center gap-1 rounded border border-dashed w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-solid transition-colors">
                <Plus className="h-3 w-3" />
                Novo campo
              </button>
            )}
          </>
        )}

        {activeFields.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum campo cadastrado</p>
        )}
      </div>
    </div>
  )
}

function SortableTabularRow({
  field,
  isEditing,
  editName,
  editDefaultValue,
  editRef,
  isReadonly,
  onStartEdit,
  onConfirm,
  onCancel,
  onNameChange,
  onDefaultValueChange,
  onDelete,
}: {
  field: MeasurementField
  isEditing: boolean
  editName: string
  editDefaultValue: string
  editRef?: React.RefObject<HTMLInputElement | null>
  isReadonly: boolean
  onStartEdit: () => void
  onConfirm: () => void
  onCancel: () => void
  onNameChange: (v: string) => void
  onDefaultValueChange: (v: string) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
    disabled: isReadonly,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="rounded border bg-card px-2.5 py-1.5 text-sm">
      <div className="flex items-center gap-2">
        {!isReadonly && (
          <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none focus:outline-none" aria-label="Arrastar">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
          </button>
        )}
        {isEditing ? (
          <>
            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                ref={editRef}
                value={editName}
                onChange={(e) => onNameChange(e.target.value)}
                className="w-full text-sm border-none bg-transparent focus:outline-none font-medium"
                placeholder="Nome do campo"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onConfirm() }
                  if (e.key === 'Escape') onCancel()
                  if (e.key === 'Tab') { e.preventDefault(); onConfirm() }
                }}
              />
              <Input
                value={editDefaultValue}
                onChange={(e) => onDefaultValueChange(e.target.value)}
                placeholder="Valor padrão nesta linha (opcional)"
                className="h-6 text-xs"
                maxLength={500}
              />
            </div>
            <div className="flex gap-1 shrink-0">
              <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={onConfirm}>
                <Check className="h-3 w-3" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onCancel}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <span className={cn('text-sm font-medium', !isReadonly && 'cursor-pointer hover:text-primary')} onClick={!isReadonly ? onStartEdit : undefined}>
                {field.name}
              </span>
              {field.defaultValue && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{field.defaultValue}</p>
              )}
            </div>
            {!isReadonly && (
              <button type="button" onClick={onDelete} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SheetEditorPanel({
  sheet,
  isReadonly,
  onDeleted,
}: {
  sheet: MeasurementSheet
  isReadonly: boolean
  onDeleted: () => void
}) {
  const [isEditingMeta, setIsEditingMeta] = useState(false)
  const [editName, setEditName] = useState(sheet.name)
  const [editCategory, setEditCategory] = useState<MeasurementCategory>(sheet.category)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  const updateSheet = useUpdateMeasurementSheet()
  const deleteSheet = useDeleteMeasurementSheet()

  // Sync quando a sheet muda (ex: outra ficha selecionada)
  useEffect(() => {
    setEditName(sheet.name)
    setEditCategory(sheet.category)
    setIsEditingMeta(false)
  }, [sheet.id, sheet.name, sheet.category])

  async function handleSaveMeta() {
    if (!editName.trim()) return
    const isDirty = editName.trim() !== sheet.name || editCategory !== sheet.category
    if (!isDirty) { setIsEditingMeta(false); return }
    try {
      await updateSheet.mutateAsync({ id: sheet.id, name: editName.trim(), category: editCategory })
      toast.success('Ficha atualizada')
      setIsEditingMeta(false)
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { error?: string } } })?.response?.data
      if (d?.error === 'CONFLICT') toast.error('Já existe uma ficha com este nome')
      else toast.error('Erro ao atualizar ficha')
    }
  }

  async function handleDelete() {
    try {
      await deleteSheet.mutateAsync(sheet.id)
      toast.success('Ficha excluída')
      setIsDeleteConfirmOpen(false)
      onDeleted()
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { message?: string } } })?.response?.data
      if (d?.message === 'HAS_HISTORY') {
        toast.error('Esta ficha possui avaliações registradas. Para ocultá-la, desative-a.')
      } else {
        toast.error('Erro ao excluir ficha')
      }
      setIsDeleteConfirmOpen(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header editável */}
      <div className="px-4 py-3 border-b">
        {isEditingMeta ? (
          <div className="space-y-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 text-sm font-medium"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void handleSaveMeta() }
                if (e.key === 'Escape') { setIsEditingMeta(false); setEditName(sheet.name); setEditCategory(sheet.category) }
              }}
            />
            {!isReadonly && (
              <Select value={editCategory} onValueChange={(v) => setEditCategory(v as MeasurementCategory)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_CATEGORIES_ORDER.map((cat) => (
                    <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={handleSaveMeta} disabled={updateSheet.isPending || !editName.trim()}>
                {updateSheet.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-0.5" />}
                Salvar
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setIsEditingMeta(false); setEditName(sheet.name); setEditCategory(sheet.category) }}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {sheet.type === 'TABULAR' ? <Table2 className="h-4 w-4 text-muted-foreground shrink-0" /> : <List className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className="text-sm font-medium truncate flex-1">{sheet.name}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0', SHEET_TYPE_BADGE_COLOR[sheet.type])}>
              {SHEET_TYPE_LABELS[sheet.type]}
            </span>
            {!isReadonly && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={() => setIsEditingMeta(true)} aria-label="Editar ficha">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setIsDeleteConfirmOpen(true)} aria-label="Excluir ficha">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {sheet.type === 'SIMPLE' ? <SimpleSheetEditor sheet={sheet} isReadonly={isReadonly} /> : <TabularSheetEditor sheet={sheet} isReadonly={isReadonly} />}
      </div>

      {/* Dialog de confirmação de exclusão */}
      {isDeleteConfirmOpen && (
        <Dialog open onClose={() => setIsDeleteConfirmOpen(false)} className="max-w-sm">
          <DialogTitle>Excluir ficha?</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Esta ação não pode ser desfeita. Se a ficha tiver avaliações registradas, não será possível excluí-la — desative-a em vez disso.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteConfirmOpen(false)} disabled={deleteSheet.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteSheet.isPending}>
              {deleteSheet.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}

function EmptyEditorPlaceholder() {
  return (
    <div className="rounded-lg border bg-card h-full flex items-center justify-center py-16">
      <div className="text-center">
        <Eye className="mx-auto mb-2 h-8 w-8 opacity-20" />
        <p className="text-xs text-muted-foreground">Selecione uma ficha para visualizar</p>
      </div>
    </div>
  )
}

export function MeasurementSheetsSettings() {
  const [selectedCategory, setSelectedCategory] = useState<MeasurementCategory>('CORPORAL')
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null)
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false)
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false)
  const [isEditorCollapsibleOpen, setIsEditorCollapsibleOpen] = useState(false)

  const { data: systemSheets = [], isPending: systemPending } = useMeasurementSheets({ scope: 'SYSTEM' })
  const { data: customerSheets = [], isPending: customerPending } = useMeasurementSheets({ scope: 'CUSTOMER' })
  const reorder = useReorderMeasurementSheets()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const counts = useMemo(() => {
    const result = { CORPORAL: 0, FACIAL: 0, DERMATO_FUNCIONAL: 0, NUTRICIONAL: 0, POSTURAL: 0, PERSONALIZADA: 0 } as Record<MeasurementCategory, number>
    for (const s of systemSheets) {
      if (s.active && s.category) result[s.category] = (result[s.category] ?? 0) + 1
    }
    result.PERSONALIZADA = customerSheets.filter((s) => s.active).length
    return result
  }, [systemSheets, customerSheets])

  const isPersonalizada = selectedCategory === 'PERSONALIZADA'
  const isPending = isPersonalizada ? customerPending : systemPending

  const sheetsForCategory = useMemo(() => {
    const source = isPersonalizada ? customerSheets : systemSheets
    return source
      .filter((s) => s.active && (isPersonalizada || s.category === selectedCategory))
      .sort((a, b) => a.order - b.order)
  }, [isPersonalizada, customerSheets, systemSheets, selectedCategory])

  const selectedSheet = sheetsForCategory.find((s) => s.id === selectedSheetId) ?? null

  useEffect(() => {
    setSelectedSheetId(null)
    setIsEditorCollapsibleOpen(false)
  }, [selectedCategory])

  function handleSelectSheet(id: string) {
    setSelectedSheetId(id)
    setIsEditorCollapsibleOpen(true)
  }

  function handleSheetCreated(sheetId: string) {
    setIsNewSheetOpen(false)
    setSelectedSheetId(sheetId)
    setIsEditorCollapsibleOpen(true)
  }

  function handleTemplateSheetCreated(sheet: MeasurementSheet) {
    setIsTemplateDrawerOpen(false)
    setSelectedCategory(sheet.category)
    setSelectedSheetId(sheet.id)
    setIsEditorCollapsibleOpen(true)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sheetsForCategory.findIndex((s) => s.id === active.id)
    const newIdx = sheetsForCategory.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(sheetsForCategory, oldIdx, newIdx)
    reorder.mutate(reordered.map((s, i) => ({ id: s.id, order: i + 1 })))
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fichas de Avaliação</h2>
        <Button variant="outline" size="sm" onClick={() => setIsTemplateDrawerOpen(true)}>
          <LibraryBig className="mr-1.5 h-4 w-4" />
          Usar modelo
        </Button>
      </div>

      <div className="flex gap-4 min-h-[480px]">
        <aside className="w-48 shrink-0">
          <nav className="space-y-0.5">
            {MEASUREMENT_CATEGORIES_ORDER.map((cat) => {
              const Icon = CATEGORY_ICON[cat]
              const count = counts[cat] ?? 0
              const isSelected = cat === selectedCategory
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{CATEGORY_LABELS[cat]}</span>
                  <span className={cn('text-xs tabular-nums shrink-0', count === 0 && 'text-muted-foreground')}>({count})</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="w-64 shrink-0">
          <div className="rounded-lg border bg-card h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h3 className="text-sm font-medium">Fichas — {CATEGORY_LABELS[selectedCategory]}</h3>
              {!isPersonalizada && (
                <Button variant="outline" size="sm" onClick={() => setIsNewSheetOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Nova ficha
                </Button>
              )}
            </div>

            <div className="flex-1">
              {isPending ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : sheetsForCategory.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  <p className="text-sm">Nenhuma ficha cadastrada nesta categoria.</p>
                  {!isPersonalizada && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsNewSheetOpen(true)}>
                      Nova ficha
                    </Button>
                  )}
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sheetsForCategory.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="divide-y">
                      {sheetsForCategory.map((sheet) => (
                        <SortableSheetItem
                          key={sheet.id}
                          sheet={sheet}
                          selected={sheet.id === selectedSheetId}
                          onSelect={() => handleSelectSheet(sheet.id)}
                          isReadonly={isPersonalizada}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>

        <div className="hidden xl:flex xl:flex-1 xl:min-w-0">
          {selectedSheet ? (
            <SheetEditorPanel sheet={selectedSheet} isReadonly={isPersonalizada} onDeleted={() => setSelectedSheetId(null)} />
          ) : (
            <EmptyEditorPlaceholder />
          )}
        </div>
      </div>

      {selectedSheet && (
        <Collapsible open={isEditorCollapsibleOpen} onOpenChange={setIsEditorCollapsibleOpen} className="xl:hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
            <span className="truncate">Visualizar: {selectedSheet.name}</span>
            {isEditorCollapsibleOpen ? <ChevronUp className="h-4 w-4 shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 shrink-0 ml-2" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <SheetEditorPanel sheet={selectedSheet} isReadonly={isPersonalizada} onDeleted={() => setSelectedSheetId(null)} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {isNewSheetOpen && (
        <NewSheetDialog
          category={selectedCategory}
          onClose={() => setIsNewSheetOpen(false)}
          onCreated={handleSheetCreated}
        />
      )}

      <MeasurementTemplatesDrawer
        open={isTemplateDrawerOpen}
        onClose={() => setIsTemplateDrawerOpen(false)}
        onSheetCreated={handleTemplateSheetCreated}
      />
    </div>
  )
}
