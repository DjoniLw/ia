'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Info, Pencil, Search, Trash2, Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTitle } from '@/components/ui/dialog'

type StatusFilter = 'all' | 'active' | 'inactive'
const STATUS_LABELS: Record<StatusFilter, string> = { all: 'Todos', active: 'Ativos', inactive: 'Inativos' }
import {
  type Equipment,
  useEquipment,
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
} from '@/lib/hooks/use-resources'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { DataPagination } from '@/components/ui/data-pagination'

// ──── Equipment Form ──────────────────────────────────────────────────────────

function EquipmentForm({
  initial,
  onSave,
  onCancel,
  isPending,
  showActiveToggle = false,
  onDirtyChange,
}: {
  initial?: Equipment
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
          placeholder="Ex: Laser IPL, Ultrassom focalizado…"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={description}
          onChange={(e) => { setDescription(e.target.value); markDirty() }}
          placeholder="Informações adicionais sobre o equipamento"
        />
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="eq-active"
            checked={active}
            onChange={(e) => { setActive(e.target.checked); markDirty() }}
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

function EquipmentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = usePaginatedQuery({ defaultPageSize: 20 })
  const createEquipment = useCreateEquipment()
  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [deleting, setDeleting] = useState<Equipment | null>(null)

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
    const statusMap: Record<StatusFilter, string> = { all: 'todos', active: 'apenas ativos', inactive: 'apenas inativos' }
    parts.push(statusMap[statusFilter])
    if (search) parts.push(`busca: ${search}`)
    return parts.join(' · ')
  }

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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); resetPage() }, 250)
    return () => clearTimeout(t)
  }, [search])

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    if (search) p.set('search', search) else p.delete('search')
    if (statusFilter !== 'all') p.set('status', statusFilter) else p.delete('status')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams, search, statusFilter])

  const params: Record<string, string> = {
    ...paginationParams,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(statusFilter === 'active' && { active: 'true' }),
    ...(statusFilter === 'inactive' && { active: 'false' }),
  }
  const { data: equipmentData, isLoading } = useEquipment(params)

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
      ) : !equipmentData?.items.length ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <Wrench className="mx-auto mb-2 h-8 w-8 opacity-30" />
          {isDefaultFilters ? (
            <>
              <p className="text-sm">Nenhum equipamento cadastrado.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreating(true)}>
                Criar primeiro equipamento
              </Button>
            </>
          ) : (
            <p className="text-sm">Nenhum resultado para os filtros selecionados.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {(equipmentData?.items ?? []).map((eq) => (
            <EquipmentRow
              key={eq.id}
              eq={eq}
              onEdit={() => setEditing(eq)}
              onDelete={() => setDeleting(eq)}
            />
          ))}
        </div>
      )}

      <DataPagination
        page={page}
        pageSize={pageSize}
        total={equipmentData?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)} isDirty={formDirty}>
          <DialogTitle>Novo Equipamento</DialogTitle>
          <div className="mt-4">
            <EquipmentForm
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              isPending={createEquipment.isPending}
              onDirtyChange={setFormDirty}
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
export default function EquipmentPage() {
  return (
    <Suspense fallback={null}>
      <EquipmentPageContent />
    </Suspense>
  )
}
// ──── Edit Dialog (needs its own hook call) ───────────────────────────────────

function EditDialog({ equipment, onClose }: { equipment: Equipment; onClose: () => void }) {
  const update = useUpdateEquipment(equipment.id)
  const [isDirty, setIsDirty] = useState(false)

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
    <Dialog open onClose={onClose} isDirty={isDirty}>
      <DialogTitle>Editar Equipamento</DialogTitle>
      <div className="mt-4">
        <EquipmentForm
          initial={equipment}
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
