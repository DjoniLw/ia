'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Info, PackageOpen, Plus, Pencil, Search, Trash2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import {
  type Supply,
  useSupplies,
  useCreateSupply,
  useUpdateSupply,
  useDeleteSupply,
  useCreateProduct,
} from '@/lib/hooks/use-resources'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { usePersistedFilter } from '@/lib/hooks/use-persisted-filter'
import { DataPagination } from '@/components/ui/data-pagination'

function formatCost(cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ──── Supply Form ──────────────────────────────────────────────────────────────

function SupplyForm({
  initial,
  onSave,
  onCancel,
  isPending,
  showActiveToggle = false,
  onDirtyChange,
}: {
  initial?: Supply
  onSave: (data: {
    name: string
    description: string
    unit: string
    costPrice: number | null
    stock: number
    minStock: number
    active?: boolean
  }) => Promise<void>
  onCancel: () => void
  isPending: boolean
  showActiveToggle?: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? 'un')
  const [costPrice, setCostPrice] = useState(
    initial?.costPrice != null ? (initial.costPrice / 100).toFixed(2).replace('.', ',') : '',
  )
  const [stock, setStock] = useState(String(initial?.stock ?? 0))
  const [minStock, setMinStock] = useState(String(initial?.minStock ?? 0))
  const [active, setActive] = useState(initial?.active ?? true)
  const [dirty, setDirty] = useState(false)

  function markDirty() {
    if (!dirty) {
      setDirty(true)
      onDirtyChange?.(true)
    }
  }

  function parseCost(v: string): number | null {
    if (!v.trim()) return null
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? null : Math.round(n * 100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onSave({
      name: name.trim(),
      description: description.trim(),
      unit: unit.trim() || 'un',
      costPrice: parseCost(costPrice),
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 0,
      ...(showActiveToggle ? { active } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input value={name} onChange={(e) => { setName(e.target.value); markDirty() }} placeholder="Ex: Seringa 5ml" required />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => { setDescription(e.target.value); markDirty() }} placeholder="Opcional" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Unidade</Label>
          <Input value={unit} onChange={(e) => { setUnit(e.target.value); markDirty() }} placeholder="un, ml, g…" />
        </div>
        <div className="space-y-2">
          <Label>Custo unitário (R$)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input
              value={costPrice}
              onChange={(e) => { setCostPrice(e.target.value); markDirty() }}
              placeholder="0,00"
              className="pl-9"
              inputMode="decimal"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estoque atual</Label>
          <Input type="number" value={stock} onChange={(e) => { setStock(e.target.value); markDirty() }} min={0} />
        </div>
        <div className="space-y-2">
          <Label>Estoque mínimo</Label>
          <Input type="number" value={minStock} onChange={(e) => { setMinStock(e.target.value); markDirty() }} min={0} />
        </div>
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="supply-active"
            checked={active}
            onChange={(e) => { setActive(e.target.checked); markDirty() }}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="supply-active" className="cursor-pointer">Insumo ativo</Label>
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

// ──── Page ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'inactive'
const STATUS_LABELS: Record<StatusFilter, string> = { all: 'Todos', active: 'Ativos', inactive: 'Inativos' }

function SuppliesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = usePaginatedQuery({ defaultPageSize: 20 })
  const createSupply = useCreateSupply()
  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Supply | null>(null)
  const [deleting, setDeleting] = useState<Supply | null>(null)
  const [converting, setConverting] = useState<Supply | null>(null)

  // ── Filters ──
  const [search, setSearch] = usePersistedFilter('aesthera-filter-supplies-search', searchParams.get('search'), '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [statusFilter, setStatusFilter] = usePersistedFilter<StatusFilter>('aesthera-filter-supplies-status', searchParams.get('status') as StatusFilter | null, 'all')

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

  async function handleCreate(d: Parameters<typeof createSupply.mutateAsync>[0]) {
    try {
      await createSupply.mutateAsync(d)
      toast.success('Insumo criado')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar insumo')
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

  const params: Record<string, string> = {
    ...paginationParams,
    ...(debouncedSearch && { name: debouncedSearch }),
    ...(statusFilter === 'active' && { active: 'true' }),
    ...(statusFilter === 'inactive' && { active: 'false' }),
  }
  const { data, isLoading } = useSupplies(params)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Insumos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie consumíveis utilizados nos serviços.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Insumo
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

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando…</div>
      ) : !data?.items.length ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <PackageOpen className="mx-auto mb-2 h-8 w-8 opacity-30" />
          {isDefaultFilters ? (
            <p className="text-sm">Nenhum insumo cadastrado.</p>
          ) : (
            <p className="text-sm">Nenhum resultado para os filtros selecionados.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 font-medium">Unidade</th>
                <th className="hidden sm:table-cell text-right px-4 py-3 font-medium">Custo unitário</th>
                <th className="text-right px-4 py-3 font-medium">Estoque</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data?.items ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {s.name}
                    {s.description && <span className="block text-xs text-muted-foreground">{s.description}</span>}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">{s.unit}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right">{formatCost(s.costPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={s.stock <= s.minStock ? 'text-orange-600 font-medium' : ''}>
                      {s.stock}
                    </span>
                    {s.minStock > 0 && <span className="text-xs text-muted-foreground"> / mín {s.minStock}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" title="Transformar em produto de venda" onClick={() => setConverting(s)}>
                      <ShoppingBag className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <DataPagination
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {creating && (
        <Dialog open onClose={() => setCreating(false)} isDirty={formDirty}>
          <DialogTitle>Novo Insumo</DialogTitle>
          <div className="mt-4">
            <SupplyForm
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              isPending={createSupply.isPending}
              onDirtyChange={setFormDirty}
            />
          </div>
        </Dialog>
      )}

      {editing && <EditSupplyDialog supply={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteSupplyDialog supply={deleting} onClose={() => setDeleting(null)} />}
      {converting && <ConvertToProductDialog supply={converting} onClose={() => setConverting(null)} />}
    </div>
  )
}

export default function SuppliesPage() {
  return (
    <Suspense fallback={null}>
      <SuppliesPageContent />
    </Suspense>
  )
}

function EditSupplyDialog({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const update = useUpdateSupply(supply.id)
  const [isDirty, setIsDirty] = useState(false)

  async function handleSave(d: Parameters<typeof update.mutateAsync>[0]) {
    try {
      await update.mutateAsync(d)
      toast.success('Insumo atualizado')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar insumo')
    }
  }

  return (
    <Dialog open onClose={onClose} isDirty={isDirty}>
      <DialogTitle>Editar Insumo</DialogTitle>
      <div className="mt-4">
        <SupplyForm initial={supply} onSave={handleSave} onCancel={onClose} isPending={update.isPending} showActiveToggle onDirtyChange={setIsDirty} />
      </div>
    </Dialog>
  )
}

function DeleteSupplyDialog({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const del = useDeleteSupply()

  async function handleConfirm() {
    try {
      await del.mutateAsync(supply.id)
      toast.success('Insumo removido')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao remover insumo')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Remover Insumo</DialogTitle>
      <div className="space-y-4 mt-4">
        <p className="text-sm text-muted-foreground">
          Remover o insumo <strong>{supply.name}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm}>Remover</Button>
        </div>
      </div>
    </Dialog>
  )
}

// ──── ConvertToProductDialog ──────────────────────────────────────────────────

function ConvertToProductDialog({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const createProduct = useCreateProduct()
  const [price, setPrice] = useState(
    supply.costPrice != null ? (supply.costPrice / 100).toFixed(2).replace('.', ',') : '',
  )
  const [stock, setStock] = useState(String(supply.stock))
  const [minStock, setMinStock] = useState(String(supply.minStock))

  function parsePrice(v: string): number {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : Math.round(n * 100)
  }

  async function handleConfirm() {
    try {
      await createProduct.mutateAsync({
        name: supply.name,
        description: supply.description,
        category: null,
        brand: null,
        sku: null,
        barcode: null,
        price: parsePrice(price),
        costPrice: supply.costPrice,
        stock: parseInt(stock) || 0,
        minStock: parseInt(minStock) || 0,
        unit: supply.unit,
        imageUrl: null,
        ncm: null,
        cest: null,
        cfop: null,
      })
      toast.success(`"${supply.name}" adicionado como produto de venda`)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar produto')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Transformar em produto de venda</DialogTitle>
      <div className="space-y-4 mt-4">
        <p className="text-sm text-muted-foreground">
          Isso criará um produto de venda baseado no insumo <strong>{supply.name}</strong>.
          O insumo original não será alterado.
        </p>
        <div className="space-y-2">
          <Label>Preço de venda (R$) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              className="pl-9"
              inputMode="decimal"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Custo unitário do insumo: {supply.costPrice != null ? `R$ ${(supply.costPrice / 100).toFixed(2)}` : '—'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Estoque inicial</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} min={0} />
          </div>
          <div className="space-y-2">
            <Label>Estoque mínimo</Label>
            <Input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} min={0} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={createProduct.isPending || !price.trim()}>
            {createProduct.isPending ? 'Criando…' : 'Criar produto'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
