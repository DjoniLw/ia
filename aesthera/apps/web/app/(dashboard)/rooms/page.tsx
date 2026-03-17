'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, DoorOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import {
  type Room,
  useRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
} from '@/lib/hooks/use-resources'

// ──── Room Form ───────────────────────────────────────────────────────────────

function RoomForm({
  initial,
  onSave,
  onCancel,
  isPending,
  showActiveToggle = false,
}: {
  initial?: Room
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
          placeholder="Ex: Sala 1, Sala VIP, Sala de Depilação…"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Informações adicionais sobre a sala"
        />
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="room-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="room-active" className="cursor-pointer">
            Sala ativa (disponível para agendamentos)
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

// ──── Delete Confirm ──────────────────────────────────────────────────────────

function DeleteConfirm({
  room,
  onConfirm,
  onCancel,
}: {
  room: Room
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tem certeza que deseja remover a sala <strong>{room.name}</strong>? Esta ação não pode ser desfeita.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Remover
        </Button>
      </div>
    </div>
  )
}

// ──── Room Row ────────────────────────────────────────────────────────────────

function RoomRow({ room, onEdit, onDelete }: { room: Room; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            room.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          <DoorOpen className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{room.name}</p>
          {room.description && <p className="text-xs text-muted-foreground">{room.description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!room.active && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inativa</span>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ──── Edit Dialog ─────────────────────────────────────────────────────────────

function EditDialog({ room, onClose }: { room: Room; onClose: () => void }) {
  const update = useUpdateRoom(room.id)

  async function handleSave(data: { name: string; description: string; active?: boolean }) {
    try {
      await update.mutateAsync(data)
      toast.success('Sala atualizada')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar sala')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Editar Sala</DialogTitle>
      <div className="mt-4">
        <RoomForm
          initial={room}
          onSave={handleSave}
          onCancel={onClose}
          isPending={update.isPending}
          showActiveToggle
        />
      </div>
    </Dialog>
  )
}

// ──── Delete Dialog ───────────────────────────────────────────────────────────

function DeleteDialog({ room, onClose }: { room: Room; onClose: () => void }) {
  const del = useDeleteRoom(room.id)

  async function handleConfirm() {
    try {
      await del.mutateAsync()
      toast.success('Sala removida')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao remover sala')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Remover Sala</DialogTitle>
      <div className="mt-4">
        <DeleteConfirm room={room} onConfirm={handleConfirm} onCancel={onClose} />
      </div>
    </Dialog>
  )
}

// ──── Page ────────────────────────────────────────────────────────────────────

export default function RoomsPage() {
  const { data: roomsList, isLoading } = useRooms()
  const createRoom = useCreateRoom()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [deleting, setDeleting] = useState<Room | null>(null)

  async function handleCreate(data: { name: string; description: string }) {
    try {
      await createRoom.mutateAsync(data)
      toast.success('Sala criada com sucesso')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar sala')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Salas</h2>
          <p className="text-sm text-muted-foreground">Gerencie as salas da clínica.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Sala
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando…</div>
      ) : !roomsList || roomsList.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <DoorOpen className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhuma sala cadastrada.</p>
          <p className="mt-1 text-xs">Clique em &quot;Nova Sala&quot; para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {roomsList.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              onEdit={() => setEditing(room)}
              onDelete={() => setDeleting(room)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)}>
          <DialogTitle>Nova Sala</DialogTitle>
          <div className="mt-4">
            <RoomForm
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              isPending={createRoom.isPending}
            />
          </div>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && <EditDialog room={editing} onClose={() => setEditing(null)} />}

      {/* Delete dialog */}
      {deleting && <DeleteDialog room={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
