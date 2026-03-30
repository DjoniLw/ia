'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Info, Pencil, Search, Trash2, Plus, DoorOpen } from 'lucide-react'
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
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { DataPagination } from '@/components/ui/data-pagination'

type StatusFilter = 'all' | 'active' | 'inactive'
const STATUS_LABELS: Record<StatusFilter, string> = { all: 'Todos', active: 'Ativos', inactive: 'Inativos' }

// ──── Room Form ───────────────────────────────────────────────────────────────

function RoomForm({
  initial,
  onSave,
  onCancel,
  isPending,
  showActiveToggle = false,
  onDirtyChange,
}: {
  initial?: Room
  onSave: (data: { name: string; description: string; active?: boolean }) => Promise<void>
  onCancel: () => void
  isPending: boolean
  showActiveToggle?: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [dirty, setDirty] = useState(false)

  function markDirty() {
    if (!dirty) {
      setDirty(true)
      onDirtyChange?.(true)
    }
  }

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
          onChange={(e) => { setName(e.target.value); markDirty() }}
          placeholder="Ex: Sala 1, Sala VIP, Sala de Depilação…"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={description}
          onChange={(e) => { setDescription(e.target.value); markDirty() }}
          placeholder="Informações adicionais sobre a sala"
        />
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="room-active"
            checked={active}
            onChange={(e) => { setActive(e.target.checked); markDirty() }}
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
  const [isDirty, setIsDirty] = useState(false)

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
    <Dialog open onClose={onClose} isDirty={isDirty}>
      <DialogTitle>Editar Sala</DialogTitle>
      <div className="mt-4">
        <RoomForm
          initial={room}
          onSave={handleSave}
          onCancel={onClose}
          isPending={update.isPending}
          showActiveToggle
          onDirtyChange={setIsDirty}
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

function RoomsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { page, pageSize, setPage, setPageSize, resetPage } = usePaginatedQuery({ defaultPageSize: 20 })
  const createRoom = useCreateRoom()
  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [deleting, setDeleting] = useState<Room | null>(null)

  // ── Filters ──
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') ?? '')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter | null) ?? 'all'
  )

  const isDefaultFilters = search === '' && statusFilter === 'all'

  function resetFilters() {
    setSearch('')
    setStatusFilter('all')
    resetPage()
  }

  function buildFilterLabel(): string {
    const parts: string[] = []
    const statusMap: Record<StatusFilter, string> = { all: 'todos', active: 'apenas ativas', inactive: 'apenas inativas' }
    parts.push(statusMap[statusFilter])
    if (search) parts.push(`busca: ${search}`)
    return parts.join(' · ')
  }

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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); resetPage() }, 250)
    return () => clearTimeout(t)
  }, [search])

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    search ? p.set('search', search) : p.delete('search')
    statusFilter !== 'all' ? p.set('status', statusFilter) : p.delete('status')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams, search, statusFilter])

  const { data: allRooms, isLoading } = useRooms()
  const filtered = (allRooms ?? []).filter((room) => {
    const matchesSearch = !debouncedSearch || room.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? room.active : !room.active)
    return matchesSearch && matchesStatus
  })
  const pagedItems = filtered.slice((page - 1) * pageSize, page * pageSize)

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

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome…"
              className="h-8 rounded-full border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); resetPage() }}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Exibindo {buildFilterLabel()}</span>
          {!isDefaultFilters && (
            <button type="button" onClick={resetFilters} className="ml-auto shrink-0 font-medium text-primary hover:underline">
              Restaurar padrão
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando…</div>
      ) : !filtered.length ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <DoorOpen className="mx-auto mb-2 h-8 w-8 opacity-30" />
          {isDefaultFilters ? (
            <>
              <p className="text-sm">Nenhuma sala cadastrada.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreating(true)}>
                Criar primeira sala
              </Button>
            </>
          ) : (
            <p className="text-sm">Nenhum resultado para os filtros selecionados.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {pagedItems.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              onEdit={() => setEditing(room)}
              onDelete={() => setDeleting(room)}
            />
          ))}
        </div>
      )}

      <DataPagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)} isDirty={formDirty}>
          <DialogTitle>Nova Sala</DialogTitle>
          <div className="mt-4">
            <RoomForm
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              isPending={createRoom.isPending}
              onDirtyChange={setFormDirty}
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

export default function RoomsPage() {
  return (
    <Suspense fallback={null}>
      <RoomsPageContent />
    </Suspense>
  )
}
