'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FlaskConical, Info, Pencil, Plus, Scissors, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type Service,
  useAssignServiceSupplies,
  useCreateService,
  useDeleteService,
  useServiceSupplies,
  useServices,
  useSupplies,
  useUpdateService,
} from '@/lib/hooks/use-resources'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { DataPagination } from '@/components/ui/data-pagination'

function parseBRL(value: string): number {
  // Accept "150,00" or "150.00" or "150" → returns cents
  const normalized = value.replace(/\./g, '').replace(',', '.')
  return Math.round(parseFloat(normalized) * 100)
}

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive().refine((v) => v % 15 === 0, 'Múltiplo de 15'),
  priceDisplay: z.string().min(1, 'Informe o preço').refine((v) => {
    const n = parseBRL(v)
    return !isNaN(n) && n >= 0
  }, 'Preço inválido'),
})
type ServiceFormData = z.infer<typeof serviceSchema>

function ServiceForm({
  defaultValues,
  onSave,
  isPending,
  showActiveToggle = false,
  onDirtyChange,
}: {
  defaultValues?: Partial<ServiceFormData & { price: number; active?: boolean }>
  onSave: (data: ServiceFormData & { active?: boolean }) => Promise<void>
  isPending: boolean
  showActiveToggle?: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [active, setActive] = useState(defaultValues?.active ?? true)
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          // Convert cents to display string (e.g. 15000 → "150,00")
          priceDisplay: defaultValues.price != null
            ? (defaultValues.price / 100).toFixed(2).replace('.', ',')
            : '',
        }
      : undefined,
  })

  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty, onDirtyChange])

  return (
    <form onSubmit={handleSubmit((data) => onSave({ ...data, ...(showActiveToggle ? { active } : {}) }))} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input {...register('name')} placeholder="Botox" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input {...register('description')} placeholder="Opcional" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input {...register('category')} placeholder="facial, corporal..." />
        </div>
        <div className="space-y-2">
          <Label>Duração (min)</Label>
          <Input type="number" {...register('durationMinutes')} placeholder="60" />
          {errors.durationMinutes && (
            <p className="text-xs text-destructive">{errors.durationMinutes.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Preço (R$)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
          <Input
            {...register('priceDisplay')}
            placeholder="150,00"
            className="pl-9"
            inputMode="decimal"
          />
        </div>
        {errors.priceDisplay && <p className="text-xs text-destructive">{errors.priceDisplay.message}</p>}
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="svc-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="svc-active" className="cursor-pointer">
            Serviço ativo (disponível para agendamentos)
          </Label>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

function priceDisplay(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ──── ServiceSuppliesDialog ────────────────────────────────────────────────────

function ServiceSuppliesDialog({ service, onClose }: { service: Service; onClose: () => void }) {
  const { data: suppliesData } = useSupplies({ active: 'true', limit: '100' })
  const { data: assigned, isLoading: loadingAssigned } = useServiceSupplies(service.id)
  const assignMutation = useAssignServiceSupplies(service.id)

  type Item = { supplyId: string; quantity: number; usageUnit: string; conversionFactor: number }

  // Build local editable list from current assigned
  const [items, setItems] = useState<Item[]>(() =>
    assigned?.map((ss) => ({
      supplyId: ss.supplyId,
      quantity: ss.quantity,
      usageUnit: ss.usageUnit ?? ss.supply.unit,
      conversionFactor: ss.conversionFactor ?? 1,
    })) ?? []
  )

  const [isDirty, setIsDirty] = useState(false)

  // Sync from server when data loads
  const [initialised, setInitialised] = useState(false)
  if (!initialised && assigned) {
    setItems(assigned.map((ss) => ({
      supplyId: ss.supplyId,
      quantity: ss.quantity,
      usageUnit: ss.usageUnit ?? ss.supply.unit,
      conversionFactor: ss.conversionFactor ?? 1,
    })))
    setInitialised(true)
  }

  function addSupply(supplyId: string) {
    if (items.some((i) => i.supplyId === supplyId)) return
    const supply = suppliesData?.items.find((s) => s.id === supplyId)
    setItems((prev) => [...prev, { supplyId, quantity: 1, usageUnit: supply?.unit ?? 'un', conversionFactor: 1 }])
    setIsDirty(true)
  }

  function removeSupply(supplyId: string) {
    setItems((prev) => prev.filter((i) => i.supplyId !== supplyId))
    setIsDirty(true)
  }

  function setQty(supplyId: string, qty: number) {
    setItems((prev) => prev.map((i) => i.supplyId === supplyId ? { ...i, quantity: qty } : i))
    setIsDirty(true)
  }

  function setUsageUnit(supplyId: string, unit: string) {
    setItems((prev) => prev.map((i) => i.supplyId === supplyId ? { ...i, usageUnit: unit } : i))
    setIsDirty(true)
  }

  function setConversionFactor(supplyId: string, factor: number) {
    setItems((prev) => prev.map((i) => i.supplyId === supplyId ? { ...i, conversionFactor: factor } : i))
    setIsDirty(true)
  }

  const unassigned = suppliesData?.items.filter((s) => !items.some((i) => i.supplyId === s.id)) ?? []

  async function handleSave() {
    try {
      await assignMutation.mutateAsync(
        items.map((i) => ({
          supplyId: i.supplyId,
          quantity: i.quantity,
          usageUnit: i.usageUnit || null,
          conversionFactor: i.conversionFactor,
        })),
      )
      toast.success('Insumos atualizados')
      onClose()
    } catch {
      toast.error('Erro ao salvar insumos')
    }
  }

  // Compute total cost — cost = (costPrice * quantity) / conversionFactor
  const totalCost = items.reduce((sum, item) => {
    const supply = suppliesData?.items.find((s) => s.id === item.supplyId)
    return sum + (supply?.costPrice ?? 0) * item.quantity / (item.conversionFactor || 1)
  }, 0)

  return (
    <Dialog open onClose={onClose} className="max-w-2xl" isDirty={isDirty}>
      <DialogTitle>Insumos de: {service.name}</DialogTitle>
      <p className="text-xs text-muted-foreground mb-3">
        Defina os insumos, quantidades e unidades usadas por execução deste serviço.
        Use o fator de conversão quando a unidade de uso for diferente da unidade de compra.
      </p>

      {loadingAssigned ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {/* Column headers */}
          {items.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_80px_90px_70px_24px] gap-2 px-3 text-xs text-muted-foreground font-medium">
              <span>Insumo</span>
              <span className="text-center">Qtd</span>
              <span className="text-center">Un. uso</span>
              <span className="text-center">Fator conv.</span>
              <span className="text-right">Custo</span>
              <span />
            </div>
          )}

          {/* Assigned supplies list */}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nenhum insumo atribuído.</p>
          )}
          {items.map((item) => {
            const supply = suppliesData?.items.find((s) => s.id === item.supplyId)
            if (!supply) return null
            const lineCost = (supply.costPrice ?? 0) * item.quantity / (item.conversionFactor || 1)
            const stockConsumed = item.quantity / (item.conversionFactor || 1)
            const showConversion = item.conversionFactor !== 1 || item.usageUnit !== supply.unit
            return (
              <div key={item.supplyId} className="rounded-lg border bg-card px-3 py-2 space-y-1">
                <div className="grid grid-cols-[1fr_80px_80px_90px_70px_24px] gap-2 items-center">
                  <div>
                    <span className="text-sm font-medium">{supply.name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">({supply.unit})</span>
                  </div>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.quantity}
                    onChange={(e) => setQty(item.supplyId, parseFloat(e.target.value) || 0)}
                    className="w-full text-center text-sm"
                  />
                  <Input
                    type="text"
                    value={item.usageUnit}
                    onChange={(e) => setUsageUnit(item.supplyId, e.target.value)}
                    placeholder={supply.unit}
                    className="w-full text-center text-sm"
                  />
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.conversionFactor}
                    onChange={(e) => setConversionFactor(item.supplyId, parseFloat(e.target.value) || 1)}
                    className="w-full text-center text-sm"
                    title={`1 ${supply.unit} = ${item.conversionFactor} ${item.usageUnit}`}
                  />
                  <span className="text-xs text-muted-foreground text-right">
                    {lineCost > 0 ? `R$ ${(lineCost / 100).toFixed(2)}` : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSupply(item.supplyId)}
                    className="text-destructive hover:text-destructive/80 text-sm font-medium"
                  >
                    ✕
                  </button>
                </div>
                {showConversion && (
                  <p className="text-[10px] text-muted-foreground pl-1">
                    1 {supply.unit} = {item.conversionFactor} {item.usageUnit}
                    {' · '}consumo por exec.: {stockConsumed.toFixed(3)} {supply.unit}
                  </p>
                )}
              </div>
            )
          })}

          {/* Total cost */}
          {items.length > 0 && (
            <div className="flex justify-between items-center rounded-lg border border-dashed px-3 py-2 text-sm font-medium">
              <span>Custo total em insumos:</span>
              <span className="text-primary">R$ {(totalCost / 100).toFixed(2)}</span>
            </div>
          )}

          {/* Add supply dropdown */}
          {unassigned.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Adicionar insumo</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => { if (e.target.value) { addSupply(e.target.value); e.target.value = '' } }}
              >
                <option value="">Selecione um insumo…</option>
                {unassigned.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.unit}){s.costPrice ? ` — R$ ${(s.costPrice / 100).toFixed(2)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {unassigned.length === 0 && suppliesData?.items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Cadastre insumos na página "Insumos" antes de atribuir ao serviço.
            </p>
          )}

          {/* Legend */}
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p><strong>Qtd:</strong> quantidade usada por execução (na unidade de uso)</p>
            <p><strong>Un. uso:</strong> unidade em que o insumo é aplicado no serviço (ex: ml, g)</p>
            <p><strong>Fator conv.:</strong> quantas unidades de uso equivalem a 1 unidade de compra (ex: 1 un = 200 ml → fator 200)</p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={assignMutation.isPending}>
          {assignMutation.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Dialog>
  )
}

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Todos',
  active: 'Ativos',
  inactive: 'Inativos',
}

function ServicesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = usePaginatedQuery({ defaultPageSize: 20 })
  const { mutateAsync: create, isPending: creating } = useCreateService()
  const { mutateAsync: del } = useDeleteService()

  const [showCreate, setShowCreate] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState<Service | null>(null)
  const [managingSupplies, setManagingSupplies] = useState<Service | null>(null)
  const { mutateAsync: update, isPending: updating } = useUpdateService(editing?.id ?? '')

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
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(statusFilter === 'active' && { active: 'true' }),
    ...(statusFilter === 'inactive' && { active: 'false' }),
  }
  const { data, isLoading } = useServices(params)

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

  async function handleCreate(formData: ServiceFormData) {
    try {
      await create({
        name: formData.name,
        description: formData.description ?? null,
        category: formData.category ?? null,
        durationMinutes: formData.durationMinutes,
        price: parseBRL(formData.priceDisplay),
      })
      toast.success('Serviço criado')
      setShowCreate(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar serviço')
    }
  }

  async function handleUpdate(formData: ServiceFormData & { active?: boolean }) {
    try {
      await update({
        name: formData.name,
        description: formData.description ?? null,
        category: formData.category ?? null,
        durationMinutes: formData.durationMinutes,
        price: parseBRL(formData.priceDisplay),
        ...(formData.active !== undefined ? { active: formData.active } : {}),
      })
      toast.success('Serviço atualizado')
      setEditing(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar serviço')
    }
  }

  async function handleDelete(id: string) {
    try {
      await del(id)
      toast.success('Serviço excluído')
      setDeleting(null)
    } catch {
      toast.error('Erro ao excluir serviço')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Serviços</h2>
          <p className="text-sm text-muted-foreground">Gerencie os serviços oferecidos.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Serviço
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
          <Scissors className="mx-auto mb-2 h-8 w-8 opacity-30" />
          {isDefaultFilters ? (
            <>
              <p className="text-sm">Nenhum serviço cadastrado.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
                Criar primeiro serviço
              </Button>
            </>
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
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium">Categoria</th>
                  <th className="hidden sm:table-cell text-right px-4 py-3 font-medium">Duração</th>
                  <th className="text-right px-4 py-3 font-medium">Preço</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.items ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">{s.category ?? '—'}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-right">{s.durationMinutes}min</td>
                    <td className="px-4 py-3 text-right">{priceDisplay(s.price)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted px-2 py-0.5 text-xs text-muted-foreground'}`}>
                        {s.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" title="Gerenciar insumos" aria-label="Gerenciar insumos" onClick={() => setManagingSupplies(s)}>
                        <FlaskConical className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Editar serviço" aria-label="Editar serviço" onClick={() => setEditing(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Remover serviço"
                        aria-label="Remover serviço"
                        onClick={() => setDeleting(s)}
                        className="text-destructive hover:text-destructive"
                      >
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

      {/* Create dialog */}
      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} isDirty={formDirty}>
          <DialogTitle>Novo Serviço</DialogTitle>
          <ServiceForm onSave={handleCreate} isPending={creating} onDirtyChange={setFormDirty} />
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} isDirty={formDirty}>
          <DialogTitle>Editar Serviço</DialogTitle>
          <ServiceForm
            defaultValues={{
              ...editing,
              description: editing.description ?? undefined,
              category: editing.category ?? undefined,
            }}
            onSave={handleUpdate}
            isPending={updating}
            showActiveToggle
            onDirtyChange={setFormDirty}
          />
        </Dialog>
      )}

      {/* Delete dialog */}
      {deleting && (
        <Dialog open onClose={() => setDeleting(null)}>
          <DialogTitle>Remover Serviço</DialogTitle>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Remover o serviço <strong>{deleting.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleting.id)}>Remover</Button>
            </div>
          </div>
        </Dialog>
      )}

      {managingSupplies && (
        <ServiceSuppliesDialog
          service={managingSupplies}
          onClose={() => setManagingSupplies(null)}
        />
      )}
    </div>
  )
}

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <ServicesPageContent />
    </Suspense>
  )
}
