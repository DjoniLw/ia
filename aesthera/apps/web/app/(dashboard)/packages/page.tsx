'use client'

import { Suspense, useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus,
  Package as PackageIcon,
  Loader2,
  Pencil,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  CheckCircle2,
  Search,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataPagination } from '@/components/ui/data-pagination'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { usePersistedFilter } from '@/lib/hooks/use-persisted-filter'
import { useCustomers, useServices } from '@/lib/hooks/use-resources'
import {
  type CreatePackageInput,
  type CustomerPackage,
  type ServicePackage,
  type UpdatePackageInput,
  useCreatePackage,
  useCustomerPackages,
  usePackages,
  usePurchasePackage,
  useUpdatePackage,
} from '@/lib/hooks/use-packages'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ──── Searchable Customer Input ────────────────────────────────────────────────

function CustomerSearchInput({
  value,
  onChange,
  placeholder = 'Buscar cliente…',
}: {
  value: { id: string; name: string } | null
  onChange: (customer: { id: string; name: string } | null) => void
  placeholder?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [debounced, setDebounced] = useState('')

  const { data } = useCustomers(
    debounced.trim().length >= 1 ? { name: debounced.trim(), limit: '20' } : undefined,
  )
  const results = data?.items ?? []

  function handleInput(v: string) {
    setSearch(v)
    setOpen(true)
    if (!v) onChange(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebounced(v), 250)
  }

  function handleSelect(c: { id: string; name: string }) {
    onChange(c)
    setSearch('')
    setDebounced('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
        <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <input
          value={value && !open ? value.name : search}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { setSearch(''); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value ? value.name : placeholder}
          className="flex-1 bg-transparent text-sm focus:outline-none"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setSearch('') }}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>
      {open && search.trim().length >= 1 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-auto">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(c)}
              >
                <span className="font-medium">{c.name}</span>
                {c.phone && (
                  <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ──── Create Package Modal ─────────────────────────────────────────────────────

function PackageModal({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: ServicePackage
}) {
  const { data: servicesData } = useServices()
  const services = servicesData?.items ?? []

  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [price, setPrice] = useState(editing ? String(editing.price / 100) : '')
  const [validityDays, setValidityDays] = useState(
    editing?.validityDays != null ? String(editing.validityDays) : '',
  )
  const [active, setActive] = useState(editing?.active ?? true)
  const [items, setItems] = useState<Array<{ serviceId: string; quantity: number }>>(
    editing?.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })) ?? [
      { serviceId: '', quantity: 1 },
    ],
  )

  const createMutation = useCreatePackage()
  const updateMutation = useUpdatePackage(editing?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  function addItem() {
    setItems((prev) => [...prev, { serviceId: '', quantity: 1 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: 'serviceId' | 'quantity', value: string | number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !price) {
      toast.error('Preencha os campos obrigatórios')
      return
    }
    try {
      if (editing) {
        const dto: UpdatePackageInput = {
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          price: price ? Math.round(Number(price) * 100) : undefined,
          validityDays: validityDays ? Number(validityDays) : null,
          active,
        }
        await updateMutation.mutateAsync(dto)
        toast.success('Pacote atualizado')
      } else {
        const validItems = items.filter((i) => i.serviceId)
        if (validItems.length === 0) {
          toast.error('Adicione pelo menos um serviço ao pacote')
          return
        }
        const dto: CreatePackageInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          price: Math.round(Number(price) * 100),
          validityDays: validityDays ? Number(validityDays) : null,
          items: validItems,
        }
        await createMutation.mutateAsync(dto)
        toast.success('Pacote criado')
      }
      onClose()
    } catch {
      toast.error(editing ? 'Erro ao atualizar pacote' : 'Erro ao criar pacote')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-y-auto rounded-xl border bg-card shadow-xl max-h-[90vh]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-foreground">
            {editing ? 'Editar pacote' : 'Novo pacote'}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pacote Facial Premium"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Preço (R$) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="350,00"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Validade (dias){' '}
                <span className="font-normal text-muted-foreground/60">— opcional</span>
              </label>
              <input
                type="number"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                placeholder="Sem expiração"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {editing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active-toggle"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              <label htmlFor="active-toggle" className="text-sm text-foreground">
                Pacote ativo (disponível para venda)
              </label>
            </div>
          )}

          {!editing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Serviços incluídos *
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Adicionar serviço
                </button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={item.serviceId}
                    onChange={(e) => updateItem(index, 'serviceId', e.target.value)}
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Selecionar serviço…</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col items-center justify-center">
                    <label className="text-[10px] text-muted-foreground">Sessões</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      className="w-20 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="self-end rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar pacote'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──── Purchase Modal ───────────────────────────────────────────────────────────

function PurchaseModal({
  pkg,
  open,
  onClose,
}: {
  pkg: ServicePackage
  open: boolean
  onClose: () => void
}) {
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null)
  const purchase = usePurchasePackage(pkg.id)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) { toast.error('Selecione um cliente'); return }
    try {
      await purchase.mutateAsync(customer.id)
      toast.success('Pacote adquirido com sucesso')
      onClose()
    } catch {
      toast.error('Erro ao registrar compra do pacote')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-foreground">Vender pacote</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">{pkg.name}</div>
            <div className="mt-1 text-muted-foreground">{formatCurrency(pkg.price)}</div>
            {pkg.validityDays && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                Validade: {pkg.validityDays} dias
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Cliente *</label>
            <CustomerSearchInput value={customer} onChange={setCustomer} />
            {customer && (
              <p className="text-xs text-green-600">✓ {customer.name}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={purchase.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={purchase.isPending || !customer}>
              {purchase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar venda
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──── Customer Packages Panel ──────────────────────────────────────────────────

function CustomerPackagesPanel({ customerId }: { customerId: string }) {
  const { data, isLoading } = useCustomerPackages(customerId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando pacotes…
      </div>
    )
  }

  if (!data?.length) {
    return <p className="py-4 text-sm text-muted-foreground">Nenhum pacote adquirido.</p>
  }

  return (
    <div className="space-y-3">
      {data.map((cp) => (
        <CustomerPackageCard key={cp.id} cp={cp} />
      ))}
    </div>
  )
}

function CustomerPackageCard({ cp }: { cp: CustomerPackage }) {
  const usedSessions = cp.sessions.filter((s) => s.usedAt !== null).length
  const totalSessions = cp.sessions.length
  const progress = totalSessions > 0 ? (usedSessions / totalSessions) * 100 : 0

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-foreground">{cp.package.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Comprado em {formatDate(cp.purchasedAt)}
            {cp.expiresAt && ` · Expira em ${formatDate(cp.expiresAt)}`}
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {usedSessions}/{totalSessions} sessões
        </span>
      </div>

      {totalSessions > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {cp.sessions.length > 0 && (
        <div className="mt-3 space-y-1">
          {cp.sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <CheckCircle2
                className={`h-3.5 w-3.5 flex-shrink-0 ${
                  session.usedAt ? 'text-green-500' : 'text-muted-foreground/40'
                }`}
              />
              <span className={session.usedAt ? 'line-through opacity-60' : ''}>
                Sessão{' '}
                {session.usedAt
                  ? `— usada em ${formatDate(session.usedAt)}`
                  : '— disponível'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ──── Package Card ─────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  expanded,
  onToggle,
}: {
  pkg: ServicePackage
  expanded: boolean
  onToggle: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [lookupCustomer, setLookupCustomer] = useState<{ id: string; name: string } | null>(null)

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">{pkg.name}</h3>
              {!pkg.active && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Inativo
                </span>
              )}
            </div>
            {pkg.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{pkg.description}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{formatCurrency(pkg.price)}</span>
              {pkg.validityDays && <span>Validade: {pkg.validityDays} dias</span>}
              <span>{pkg.items.reduce((sum, i) => sum + i.quantity, 0)} sessão(ões)</span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPurchasing(true)}
              disabled={!pkg.active}
              title={!pkg.active ? 'Pacote inativo' : 'Vender para cliente'}
            >
              <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
              Vender
            </Button>
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1.5 text-muted-foreground hover:text-foreground"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onToggle}
              className="rounded p-1.5 text-muted-foreground hover:text-foreground"
              title="Verificar pacotes de um cliente"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Services tags */}
        {pkg.items.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t px-5 py-3">
            {pkg.items.map((item) => (
              <span
                key={item.serviceId}
                className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {item.service.name} × {item.quantity}
              </span>
            ))}
          </div>
        )}

        {/* Expanded: customer package lookup */}
        {expanded && (
          <div className="border-t px-5 py-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Verificar pacotes de um cliente
            </h4>
            <CustomerSearchInput
              value={lookupCustomer}
              onChange={setLookupCustomer}
              placeholder="Buscar cliente por nome ou telefone…"
            />
            {lookupCustomer && (
              <CustomerPackagesPanel customerId={lookupCustomer.id} />
            )}
          </div>
        )}
      </div>

      <PackageModal open={editing} onClose={() => setEditing(false)} editing={pkg} />
      <PurchaseModal pkg={pkg} open={purchasing} onClose={() => setPurchasing(false)} />
    </>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

function PackagesPageContent() {
  useSearchParams()
  const pagination = usePaginatedQuery({ defaultPageSize: 20 })
  const [activeFilter, setActiveFilter] = usePersistedFilter<boolean | undefined>('aesthera-filter-packages-active', null, undefined)
  const [search, setSearch] = usePersistedFilter('aesthera-filter-packages-search', null, '')
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = usePackages({
    ...(activeFilter !== undefined ? { active: activeFilter } : {}),
    page: parseInt(pagination.paginationParams.page),
    limit: parseInt(pagination.paginationParams.limit),
  })

  const filterOptions: Array<{ value: boolean | undefined; label: string }> = [
    { value: undefined, label: 'Todos' },
    { value: true, label: 'Ativos' },
    { value: false, label: 'Inativos' },
  ]

  const filteredPackages = (data?.items ?? []).filter((pkg) =>
    pkg.name.toLowerCase().includes(search.toLowerCase()),
  )

  const isDefaultFilters = activeFilter === undefined && search === ''

  function resetFilters() {
    setActiveFilter(undefined)
    setSearch('')
    pagination.resetPage()
  }

  function buildFilterLabel(): string {
    const parts: string[] = []
    if (activeFilter === true) parts.push('apenas ativos')
    else if (activeFilter === false) parts.push('apenas inativos')
    else parts.push('todos os pacotes')
    if (search) parts.push(`busca: ${search}`)
    return parts.join(' · ')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Pacotes</h2>
          <p className="text-sm text-muted-foreground">
            Pacotes de serviços com sessões pré-pagas
          </p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo pacote
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
              onChange={(e) => { setSearch(e.target.value); pagination.resetPage() }}
              placeholder="Buscar por nome…"
              className="h-8 rounded-full border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {filterOptions.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => { setActiveFilter(opt.value); pagination.resetPage() }}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                activeFilter === opt.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Legenda descritiva */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Exibindo {buildFilterLabel()}</span>
          {!isDefaultFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto shrink-0 font-medium text-primary hover:underline"
            >
              Restaurar padrão
            </button>
          )}
        </div>
      </div>

      {/* Package list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-16 text-center shadow-sm">
          <PackageIcon className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum pacote encontrado</p>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            Criar primeiro pacote
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPackages.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-8 text-center shadow-sm">
              <PackageIcon className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum pacote encontrado para os filtros selecionados.</p>
            </div>
          )}
          {filteredPackages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              expanded={expandedId === pkg.id}
              onToggle={() => setExpandedId(expandedId === pkg.id ? null : pkg.id)}
            />
          ))}
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={data?.total ?? 0}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      )}

      {/* Summary */}
      {data && data.items.length > 0 && (
        <div className="flex flex-wrap gap-6 rounded-xl border bg-card px-6 py-4 text-sm shadow-sm">
          <div>
            <p className="text-muted-foreground">Total de pacotes</p>
            <p className="text-lg font-semibold">{data.total}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ativos</p>
            <p className="text-lg font-semibold text-green-600">
              {data.items.filter((p) => p.active).length}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Sessões totais (página)</p>
            <p className="text-lg font-semibold">
              {data.items.reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.quantity, 0), 0)}
            </p>
          </div>
        </div>
      )}

      <PackageModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

export default function PackagesPage() {
  return (
    <Suspense fallback={null}>
      <PackagesPageContent />
    </Suspense>
  )
}
