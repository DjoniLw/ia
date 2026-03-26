'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, Power, Ruler } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useBodyMeasurementFields,
  useCreateBodyMeasurementField,
  useUpdateBodyMeasurementField,
  useDeleteBodyMeasurementField,
  type BodyMeasurementField,
} from '@/lib/hooks/use-body-measurements'

const MAX_ACTIVE = 30

// ── Schema ────────────────────────────────────────────────────────────────────

const fieldSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  unit: z.string().min(1, 'Unidade obrigatória').max(20),
  order: z.coerce.number().int().nonnegative().optional(),
})
type FieldForm = z.infer<typeof fieldSchema>

// ── Field dialog ──────────────────────────────────────────────────────────────

function FieldDialog({
  open,
  field,
  onClose,
}: {
  open: boolean
  field?: BodyMeasurementField
  onClose: () => void
}) {
  const createMutation = useCreateBodyMeasurementField()
  const updateMutation = useUpdateBodyMeasurementField()
  const isPending = createMutation.isPending || updateMutation.isPending

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FieldForm>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name: field?.name ?? '',
      unit: field?.unit ?? '',
      order: field?.order,
    },
  })

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (field) {
        await updateMutation.mutateAsync({ id: field.id, ...data })
        toast.success('Campo atualizado com sucesso')
      } else {
        await createMutation.mutateAsync(data)
        toast.success('Campo criado com sucesso')
      }
      onClose()
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'MAX_FIELDS_REACHED') {
        toast.error('Limite de 30 campos ativos atingido')
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
          <Input id="field-name" {...register('name')} placeholder="Ex: Peso, Altura, Cintura" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-unit">Unidade *</Label>
          <Input id="field-unit" {...register('unit')} placeholder="Ex: kg, cm, %BF" />
          {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-order">Ordem (opcional)</Label>
          <Input id="field-order" type="number" min={0} {...register('order')} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {field ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BodyMeasurementsTab() {
  const { data: fields = [], isLoading } = useBodyMeasurementFields()
  const updateMutation = useUpdateBodyMeasurementField()
  const deleteMutation = useDeleteBodyMeasurementField()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<BodyMeasurementField | undefined>()

  const activeCount = fields.filter((f) => f.active).length
  const atLimit = activeCount >= MAX_ACTIVE

  const handleToggleActive = async (field: BodyMeasurementField) => {
    try {
      if (field.active) {
        // desativar via DELETE (active = false)
        await deleteMutation.mutateAsync(field.id)
        toast.success(`Campo "${field.name}" desativado`)
      } else {
        // reativar via PATCH
        await updateMutation.mutateAsync({ id: field.id, active: true })
        toast.success(`Campo "${field.name}" reativado`)
      }
    } catch (err: any) {
      const code = err?.response?.data?.code
      if (code === 'MAX_FIELDS_REACHED') {
        toast.error('Limite de 30 campos ativos atingido')
      } else {
        toast.error('Erro ao atualizar campo')
      }
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Campos de medição</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeCount} / {MAX_ACTIVE} campos ativos
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingField(undefined)
            setDialogOpen(true)
          }}
          disabled={atLimit}
          title={atLimit ? 'Limite de 30 campos ativos atingido' : undefined}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar campo
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : fields.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Ruler className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum campo configurado.</p>
          <button
            type="button"
            onClick={() => {
              setEditingField(undefined)
              setDialogOpen(true)
            }}
            className="mt-1 text-sm underline text-primary hover:opacity-80"
          >
            + Adicionar campo
          </button>
        </div>
      ) : (
        <div className="rounded-xl border divide-y overflow-hidden">
          {fields.map((field) => (
            <div
              key={field.id}
              className={[
                'flex items-center gap-3 px-4 py-3 bg-card',
                !field.active && 'opacity-50',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{field.name}</p>
                <p className="text-xs text-muted-foreground">{field.unit}</p>
              </div>
              <span
                className={[
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  field.active
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {field.active ? 'Ativo' : 'Inativo'}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Editar campo"
                  title="Editar"
                  onClick={() => {
                    setEditingField(field)
                    setDialogOpen(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={field.active ? 'Desativar campo' : 'Reativar campo'}
                  title={field.active ? 'Desativar' : 'Reativar'}
                  onClick={() => void handleToggleActive(field)}
                  disabled={updateMutation.isPending || deleteMutation.isPending}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <FieldDialog
          open={dialogOpen}
          field={editingField}
          onClose={() => {
            setDialogOpen(false)
            setEditingField(undefined)
          }}
        />
      )}
    </div>
  )
}
