'use client'

import { useEffect, useState, Suspense } from 'react'
import { AlertCircle, CheckCircle2, Clock, Info, Plus, XCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type AccountsPayable,
  type AccountsPayablePaymentMethod,
  type AccountsPayableStatus,
  useCancelAccountsPayable,
  useCreateAccountsPayable,
  usePayAccountsPayable,
  useAccountsPayable,
  useAccountsPayableSummary,
} from '@/lib/hooks/use-accounts-payable'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { DataPagination } from '@/components/ui/data-pagination'

// ──── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function buildFilterLabel(
  statusFilter: AccountsPayableStatus | '',
  supplierSearch: string,
  categoryFilter: string,
  fromFilter: string,
  toFilter: string,
): string {
  const parts: string[] = []

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  if (!fromFilter && !toFilter) {
    parts.push('todo o período')
  } else if (fromFilter === defaultFrom && toFilter === defaultTo) {
    parts.push('mês atual')
  } else if (fromFilter && !toFilter) {
    parts.push(`a partir de ${formatDate(fromFilter)}`)
  } else if (fromFilter && toFilter) {
    parts.push(`de ${formatDate(fromFilter)} até ${formatDate(toFilter)}`)
  }

  const statusLabel: Record<string, string> = {
    '': 'todos os status',
    PENDING: 'Pendente',
    OVERDUE: 'Vencida',
    PAID: 'Paga',
    CANCELLED: 'Cancelada',
  }
  parts.push(statusLabel[statusFilter] ?? statusFilter)

  if (categoryFilter) parts.push(categoryFilter)
  if (supplierSearch) parts.push(`fornecedor: ${supplierSearch}`)

  return parts.join(' · ')
}

function parseCurrencyInput(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (!normalized) return 0
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

const STATUS_LABEL: Record<AccountsPayableStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
}

const STATUS_COLOR: Record<AccountsPayableStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  CANCELLED: 'bg-muted text-muted-foreground',
}

const STATUS_ICON: Record<AccountsPayableStatus, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  PAID: <CheckCircle2 className="h-3 w-3" />,
  OVERDUE: <AlertCircle className="h-3 w-3" />,
  CANCELLED: <XCircle className="h-3 w-3" />,
}

const CATEGORY_OPTIONS = ['Insumos', 'Equipamento', 'Aluguel', 'Serviços', 'Outros']

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'card', label: 'Cartão' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
] as const satisfies { value: import('@/lib/hooks/use-accounts-payable').AccountsPayablePaymentMethod; label: string }[]

// ──── Nova Conta Dialog ───────────────────────────────────────────────────────

function NovaContaDialog({ onClose }: { onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [description, setDescription] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [category, setCategory] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [dueDate, setDueDate] = useState(today)
  const [notes, setNotes] = useState('')

  const create = useCreateAccountsPayable()

  const isValid = description.trim().length > 0 && parseCurrencyInput(amountStr) > 0 && dueDate

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseCurrencyInput(amountStr)
    if (amount <= 0) {
      toast.error('Informe um valor válido')
      return
    }
    try {
      await create.mutateAsync({
        description: description.trim(),
        supplierName: supplierName.trim() || undefined,
        category: category || undefined,
        amount,
        dueDate: `${dueDate}T12:00:00.000Z`,
        notes: notes.trim() || undefined,
      })
      toast.success('Conta a pagar criada!')
      onClose()
    } catch {
      toast.error('Erro ao criar conta a pagar')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Nova Conta a Pagar</DialogTitle>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição *</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compra de materiais"
            className="h-9 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="supplierName">Fornecedor</Label>
            <Input
              id="supplierName"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Nome do fornecedor"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Categoria</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$) *</Label>
            <Input
              id="amount"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0,00"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Vencimento *</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            className="h-9 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!isValid || create.isPending}>
            {create.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ──── Registrar Pagamento Dialog ──────────────────────────────────────────────

function RegistrarPagamentoDialog({
  entry,
  onClose,
}: {
  entry: AccountsPayable
  onClose: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [paymentMethod, setPaymentMethod] = useState<AccountsPayablePaymentMethod>('pix')
  const [paidAt, setPaidAt] = useState(today)

  const pay = usePayAccountsPayable(entry.id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await pay.mutateAsync({ paymentMethod, paidAt: `${paidAt}T12:00:00.000Z` })
      toast.success('Pagamento registrado!')
      onClose()
    } catch {
      toast.error('Erro ao registrar pagamento')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Registrar Pagamento</DialogTitle>
      <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Conta</span>
          <span className="font-medium">{entry.description}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-bold">{formatCurrency(entry.amount)}</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Forma de Pagamento</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={[
                  'rounded-lg border py-2 px-1 text-xs font-medium transition-colors',
                  paymentMethod === m.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-card text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paidAt">Data de Pagamento</Label>
          <Input
            id="paidAt"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pay.isPending}>
            {pay.isPending ? 'Registrando…' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ──── Row Actions ─────────────────────────────────────────────────────────────

function RowActions({ entry }: { entry: AccountsPayable }) {
  const [payOpen, setPayOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const cancel = useCancelAccountsPayable(entry.id)

  if (!['PENDING', 'OVERDUE'].includes(entry.status)) return null

  async function handleCancel() {
    try {
      await cancel.mutateAsync()
      toast.success('Conta cancelada')
      setConfirmCancel(false)
    } catch {
      toast.error('Erro ao cancelar conta')
    }
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-green-700 hover:text-green-800 hover:bg-green-50 dark:text-green-400"
          onClick={() => setPayOpen(true)}
        >
          Pagar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmCancel(true)}
          disabled={cancel.isPending}
        >
          Cancelar
        </Button>
      </div>

      {payOpen && <RegistrarPagamentoDialog entry={entry} onClose={() => setPayOpen(false)} />}

      {confirmCancel && (
        <Dialog open onClose={() => setConfirmCancel(false)}>
          <DialogTitle>Cancelar Conta a Pagar</DialogTitle>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja cancelar esta conta? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmCancel(false)}>Voltar</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
                {cancel.isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}

// ──── Page ────────────────────────────────────────────────────────────────────

function ContasAPagarPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [statusFilter, setStatusFilter] = useState<AccountsPayableStatus | ''>(
    (searchParams.get('status') as AccountsPayableStatus | null) ?? '',
  )
  const [supplierSearch, setSupplierSearch] = useState(searchParams.get('supplier') ?? '')
  const [supplierSearchDebounced, setSupplierSearchDebounced] = useState(searchParams.get('supplier') ?? '')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '')
  const [fromFilter, setFromFilter] = useState(searchParams.get('from') ?? '')
  const [toFilter, setToFilter] = useState(searchParams.get('to') ?? '')
  const [novaContaOpen, setNovaContaOpen] = useState(false)

  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = usePaginatedQuery({ defaultPageSize: 20 })

  // Debounce do campo fornecedor
  useEffect(() => {
    const t = setTimeout(() => { setSupplierSearchDebounced(supplierSearch); resetPage() }, 250)
    return () => clearTimeout(t)
  }, [supplierSearch])

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    if (statusFilter) p.set('status', statusFilter) else p.delete('status')
    if (supplierSearch) p.set('supplier', supplierSearch) else p.delete('supplier')
    if (categoryFilter) p.set('category', categoryFilter) else p.delete('category')
    if (fromFilter) p.set('from', fromFilter) else p.delete('from')
    if (toFilter) p.set('to', toFilter) else p.delete('to')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams, statusFilter, supplierSearch, categoryFilter, fromFilter, toFilter])

  const isDefaultFilters =
    statusFilter === '' &&
    supplierSearch === '' &&
    categoryFilter === '' &&
    fromFilter === '' &&
    toFilter === ''

  function resetFilters() {
    setStatusFilter('')
    setSupplierSearch('')
    setSupplierSearchDebounced('')
    setCategoryFilter('')
    setFromFilter('')
    setToFilter('')
    resetPage()
  }

  const params: Record<string, string> = {
    ...paginationParams,
    ...(statusFilter && { status: statusFilter }),
    ...(supplierSearchDebounced && { supplierName: supplierSearchDebounced }),
    ...(categoryFilter && { category: categoryFilter }),
    ...(fromFilter && { from: fromFilter }),
    ...(toFilter && { to: toFilter }),
  }

  const { data, isLoading } = useAccountsPayable(params)
  const { data: summary } = useAccountsPayableSummary()

  const statuses: Array<{ value: AccountsPayableStatus | ''; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'PENDING', label: 'Pendente' },
    { value: 'OVERDUE', label: 'Vencida' },
    { value: 'PAID', label: 'Paga' },
    { value: 'CANCELLED', label: 'Cancelada' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Contas a Pagar</h2>
          <p className="text-sm text-muted-foreground">
            Controle de despesas e compras da clínica
          </p>
        </div>
        <Button onClick={() => setNovaContaOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Conta
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Pendente
            </p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">
              {formatCurrency(summary.totalPending)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Vencido
            </p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalOverdue)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pago no Mês
            </p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalPaidThisMonth)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por fornecedor…"
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            className="h-8 w-48 text-sm"
          />

          {/* Status pills */}
          <div className="flex flex-wrap gap-1">
            {statuses.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => { setStatusFilter(s.value); resetPage() }}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  statusFilter === s.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Categoria pills */}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => { setCategoryFilter(''); resetPage() }}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                categoryFilter === ''
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              Todas as categorias
            </button>
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setCategoryFilter(c); resetPage() }}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  categoryFilter === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">De</span>
            <Input
              type="date"
              value={fromFilter}
              onChange={(e) => { setFromFilter(e.target.value); resetPage() }}
              className="h-8 w-36 text-sm"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={toFilter}
              onChange={(e) => { setToFilter(e.target.value); resetPage() }}
              className="h-8 w-36 text-sm"
            />
          </div>
        </div>

        {/* Legenda descritiva */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Exibindo {buildFilterLabel(statusFilter, supplierSearchDebounced, categoryFilter, fromFilter, toFilter)}</span>
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

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vencimento</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Descrição</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Fornecedor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Valor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Origem</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : !data?.items.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma conta encontrada
                </td>
              </tr>
            ) : (
              data.items.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.dueDate)}</td>
                  <td className="px-4 py-3 font-medium">{entry.description}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {entry.supplierName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {entry.category ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(entry.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_COLOR[entry.status],
                      ].join(' ')}
                    >
                      {STATUS_ICON[entry.status]}
                      {STATUS_LABEL[entry.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {entry.originType === 'supply_purchase' ? (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        Compra de Insumo
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Manual</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions entry={entry} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DataPagination
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {novaContaOpen && <NovaContaDialog onClose={() => setNovaContaOpen(false)} />}
    </div>
  )
}

export default function ContasAPagarPage() {
  return (
    <Suspense fallback={null}>
      <ContasAPagarPageContent />
    </Suspense>
  )
}
