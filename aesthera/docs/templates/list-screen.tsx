'use client'

/**
 * LIST SCREEN TEMPLATE
 *
 * Use this file as the starting point for any new list screen.
 * Follow /docs/ui-standards.md for all conventions.
 *
 * Steps to adapt:
 *  1. Replace `Entity` / `entity` / `entities` with the real name
 *  2. Replace `EntityIcon` with the appropriate lucide-react icon
 *  3. Replace `useEntities`, `useCreateEntity`, etc. with real hooks
 *  4. Adjust the form fields inside `EntityForm`
 *  5. Remove this comment block
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTitle } from '@/components/ui/dialog'

// Replace with real types and hooks from @/lib/hooks/use-resources
type Entity = { id: string; name: string; description?: string | null; active: boolean }
declare function useEntities(): { data: Entity[] | undefined; isLoading: boolean }
declare function useCreateEntity(): { mutateAsync: (d: Omit<Entity, 'id'>) => Promise<void>; isPending: boolean }
declare function useUpdateEntity(id: string): { mutateAsync: (d: Partial<Entity>) => Promise<void>; isPending: boolean }
declare function useDeleteEntity(id: string): { mutateAsync: () => Promise<void>; isPending: boolean }

// ──── Status filter type ──────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Todos',
  active: 'Ativos',
  inactive: 'Inativos',
}

// ──── Entity Form ─────────────────────────────────────────────────────────────

function EntityForm({
  initial,
  onSave,
  onCancel,
  isPending,
  showActiveToggle = false,
  onDirtyChange,
}: {
  initial?: Entity
  onSave: (data: Omit<Entity, 'id'>) => Promise<void>
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
    await onSave({
      name: name.trim(),
      description: description.trim(),
      active,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty() }}
          placeholder="Nome do registro"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={description}
          onChange={(e) => { setDescription(e.target.value); markDirty() }}
          placeholder="Informações adicionais (opcional)"
        />
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="entity-active"
            checked={active}
            onChange={(e) => { setActive(e.target.checked); markDirty() }}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="entity-active" className="cursor-pointer">Registro ativo</Label>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

// ──── Delete Confirm ──────────────────────────────────────────────────────────

function DeleteConfirm({ entity, onConfirm, onCancel }: {
  entity: Entity
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tem certeza que deseja remover <strong>{entity.name}</strong>? Esta ação não pode ser desfeita.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button variant="destructive" onClick={onConfirm}>Remover</Button>
      </div>
    </div>
  )
}

// ──── Entity Row ──────────────────────────────────────────────────────────────

function EntityRow({ entity, onEdit, onDelete }: {
  entity: Entity
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${entity.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          <Box className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{entity.name}</p>
          {entity.description && (
            <p className="text-xs text-muted-foreground">{entity.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!entity.active && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inativo</span>
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

// ──── Page ────────────────────────────────────────────────────────────────────

export default function EntityListPage() {
  const { data: entityList, isLoading } = useEntities()
  const createEntity = useCreateEntity()
  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Entity | null>(null)
  const [deleting, setDeleting] = useState<Entity | null>(null)

  // ── Filters ──
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filtered = (entityList ?? []).filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && e.active) ||
      (statusFilter === 'inactive' && !e.active)
    return matchesSearch && matchesStatus
  })

  async function handleCreate(data: Omit<Entity, 'id'>) {
    try {
      await createEntity.mutateAsync(data)
      toast.success('Registro criado com sucesso')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar registro')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Entidades</h2>
          <p className="text-sm text-muted-foreground">Gerencie os registros.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Entidade
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48 text-sm"
        />
        {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'border border-input text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando…</div>
      ) : !entityList || entityList.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <Box className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhuma entidade cadastrada.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreating(true)}>
            Criar primeira entidade
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhum resultado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entity) => (
            <EntityRow
              key={entity.id}
              entity={entity}
              onEdit={() => setEditing(entity)}
              onDelete={() => setDeleting(entity)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)} isDirty={formDirty}>
          <DialogTitle>Nova Entidade</DialogTitle>
          <div className="mt-4">
            <EntityForm
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              isPending={createEntity.isPending}
              onDirtyChange={setFormDirty}
            />
          </div>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && <EditDialog entity={editing} onClose={() => setEditing(null)} />}

      {/* Delete dialog */}
      {deleting && <DeleteDialog entity={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}

// ──── Edit Dialog ─────────────────────────────────────────────────────────────

function EditDialog({ entity, onClose }: { entity: Entity; onClose: () => void }) {
  const update = useUpdateEntity(entity.id)
  const [isDirty, setIsDirty] = useState(false)

  async function handleSave(data: Omit<Entity, 'id'>) {
    try {
      await update.mutateAsync(data)
      toast.success('Registro atualizado')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar registro')
    }
  }

  return (
    <Dialog open onClose={onClose} isDirty={isDirty}>
      <DialogTitle>Editar Entidade</DialogTitle>
      <div className="mt-4">
        <EntityForm
          initial={entity}
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

function DeleteDialog({ entity, onClose }: { entity: Entity; onClose: () => void }) {
  const del = useDeleteEntity(entity.id)

  async function handleConfirm() {
    try {
      await del.mutateAsync()
      toast.success('Registro removido')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao remover registro')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Remover Entidade</DialogTitle>
      <div className="mt-4">
        <DeleteConfirm entity={entity} onConfirm={handleConfirm} onCancel={onClose} />
      </div>
    </Dialog>
  )
}
