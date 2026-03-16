'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import {
  type Equipment,
  useEquipment,
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
} from '@/lib/hooks/use-resources'

// ──── Equipment Form ──────────────────────────────────────────────────────────

function EquipmentForm({
  initial,
  onSave,
  onCancel,
  isPending,
  showActiveToggle = false,
}: {
  initial?: Equipment
  onSave: (data: { name: string; description: string; active?: boolean }) => Promise<void>
  onCancel: () => void
  isPending: boolean
  showActiveToggle?: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [active, setActive] = useState(initial?.active ?? true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onSave({ name: name.trim(), description: description.trim(), ...(showActiveToggle ? { active } : {}) })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Laser IPL, Ultrassom focalizado…"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Informações adicionais sobre o equipamento"
        />
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="eq-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="eq-active" className="cursor-pointer">
            Equipamento ativo (disponível para agendamentos)
          </Label>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

// ──── Delete Confirm ─────────────────────────────────────────────────────────

function DeleteConfirm({ equipment, onConfirm, onCancel }: {
  equipment: Equipment
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tem certeza que deseja remover o equipamento <strong>{equipment.name}</strong>?
        Esta ação não pode ser desfeita.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button variant="destructive" onClick={onConfirm}>Remover</Button>
      </div>
    </div>
  )
}

// ──── Equipment Row ──────────────────────────────────────────────────────────

function EquipmentRow({ eq, onEdit, onDelete }: {
  eq: Equipment
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${eq.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          <Wrench className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{eq.name}</p>
          {eq.description && (
            <p className="text-xs text-muted-foreground">{eq.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!eq.active && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Inativo
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ──── Page ────────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const { data: equipmentList, isLoading } = useEquipment()
  const createEquipment = useCreateEquipment()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [deleting, setDeleting] = useState<Equipment | null>(null)

  async function handleCreate(data: { name: string; description: string }) {
    try {
      await createEquipment.mutateAsync(data)
      toast.success('Equipamento criado com sucesso')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar equipamento')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Equipamentos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os equipamentos da clínica para controle de disponibilidade nos agendamentos.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Equipamento
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando…</div>
      ) : !equipmentList || equipmentList.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <Wrench className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum equipamento cadastrado.</p>
          <p className="mt-1 text-xs">Clique em &quot;Novo Equipamento&quot; para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {equipmentList.map((eq) => (
            <EquipmentRow
              key={eq.id}
              eq={eq}
              onEdit={() => setEditing(eq)}
              onDelete={() => setDeleting(eq)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)}>
          <DialogTitle>Novo Equipamento</DialogTitle>
          <div className="mt-4">
            <EquipmentForm
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              isPending={createEquipment.isPending}
            />
          </div>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && (
        <EditDialog equipment={editing} onClose={() => setEditing(null)} />
      )}

      {/* Delete dialog */}
      {deleting && (
        <DeleteDialog equipment={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  )
}

// ──── Edit Dialog (needs its own hook call) ───────────────────────────────────

function EditDialog({ equipment, onClose }: { equipment: Equipment; onClose: () => void }) {
  const update = useUpdateEquipment(equipment.id)

  async function handleSave(data: { name: string; description: string; active?: boolean }) {
    try {
      await update.mutateAsync(data)
      toast.success('Equipamento atualizado')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar equipamento')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Editar Equipamento</DialogTitle>
      <div className="mt-4">
        <EquipmentForm
          initial={equipment}
          onSave={handleSave}
          onCancel={onClose}
          isPending={update.isPending}
          showActiveToggle
        />
      </div>
    </Dialog>
  )
}

function DeleteDialog({ equipment, onClose }: { equipment: Equipment; onClose: () => void }) {
  const del = useDeleteEquipment(equipment.id)

  async function handleConfirm() {
    try {
      await del.mutateAsync()
      toast.success('Equipamento removido')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao remover equipamento')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Remover Equipamento</DialogTitle>
      <div className="mt-4">
        <DeleteConfirm equipment={equipment} onConfirm={handleConfirm} onCancel={onClose} />
      </div>
    </Dialog>
  )
}
