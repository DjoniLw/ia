'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { LayoutList, Plus, Search, Users, Wallet, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  useWallet,
  useWalletOverview,
  useCreateWalletEntry,
  useAdjustWalletEntry,
  type WalletEntry,
  type WalletEntryType,
  type WalletOriginType,
} from '@/lib/hooks/use-wallet'
import { useCustomers } from '@/lib/hooks/use-resources'

// ──── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

const TYPE_LABEL: Record<WalletEntryType, string> = {
  VOUCHER: 'Voucher',
  CREDIT: 'Crédito',
  CASHBACK: 'Cashback',
  PACKAGE: 'Pacote',
}

const TYPE_COLOR: Record<WalletEntryType, string> = {
  VOUCHER: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  CREDIT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  CASHBACK: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PACKAGE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  USED: 'Utilizado',
  EXPIRED: 'Expirado',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  USED: 'bg-muted text-muted-foreground',
  EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const ORIGIN_LABEL: Record<WalletOriginType, string> = {
  OVERPAYMENT: 'Troco de cobrança',
  GIFT: 'Presente / Cortesia',
  REFUND: 'Estorno',
  CASHBACK_PROMOTION: 'Cashback',
  PACKAGE_PURCHASE: 'Compra de pacote',
  VOUCHER_SPLIT: 'Divisão de voucher',
}

const TRANSACTION_LABEL: Record<string, string> = {
  CREATE: 'Criação',
  USE: 'Uso',
  SPLIT: 'Divisão',
  ADJUST: 'Ajuste',
}

// ──── Transaction History ─────────────────────────────────────────────────────

function TransactionHistory({ entry }: { entry: WalletEntry }) {
  const [expanded, setExpanded] = useState(false)

  if (!entry.transactions.length) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Histórico ({entry.transactions.length})
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {entry.transactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {TRANSACTION_LABEL[t.type] ?? 'Desconhecido'}
                </span>
                {t.description && (
                  <span className="text-muted-foreground">{t.description}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    t.type === 'USE' || (t.type === 'ADJUST' && t.value < 0)
                      ? 'text-red-600'
                      : 'text-green-600'
                  }
                >
                  {t.type === 'USE' || (t.type === 'ADJUST' && t.value < 0) ? '-' : '+'}
                  {formatCurrency(Math.abs(t.value))}
                </span>
                <span className="text-muted-foreground">{formatDate(t.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ──── Adjust Modal ────────────────────────────────────────────────────────────

function AdjustModal({
  entry,
  open,
  onClose,
}: {
  entry: WalletEntry
  open: boolean
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const adjust = useAdjustWalletEntry(entry.id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cents = Math.round(parseFloat(value) * 100)
    if (!cents || !notes) return
    try {
      await adjust.mutateAsync({ value: cents, notes })
      toast.success('Saldo ajustado com sucesso')
      onClose()
    } catch {
      toast.error('Erro ao ajustar saldo')
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Ajustar Saldo — {entry.code}</DialogTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Saldo atual: <strong>{formatCurrency(entry.balance)}</strong>
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Valor (positivo = adicionar, negativo = subtrair)
          </label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex: 10.00 ou -5.00"
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Motivo (obrigatório)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Descreva o motivo do ajuste"
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={adjust.isPending}>
            {adjust.isPending ? 'Salvando…' : 'Confirmar Ajuste'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ──── Create Modal ────────────────────────────────────────────────────────────

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [customerId, setCustomerId] = useState('')
  const [type, setType] = useState<WalletEntryType>('VOUCHER')
  const [value, setValue] = useState('')
  const [originType, setOriginType] = useState<WalletOriginType>('GIFT')
  const [expirationDate, setExpirationDate] = useState('')
  const [notes, setNotes] = useState('')

  const create = useCreateWalletEntry()
  const { data: customersData } = useCustomers({ limit: '200' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cents = Math.round(parseFloat(value) * 100)
    if (!cents || !customerId) return
    try {
      const result = await create.mutateAsync({
        customerId,
        type,
        value: cents,
        originType,
        expirationDate: expirationDate || undefined,
        notes: notes || undefined,
      })
      toast.success(`${TYPE_LABEL[type]} ${result.code} criado com sucesso!`)
      onClose()
    } catch {
      toast.error('Erro ao criar voucher')
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Criar Voucher / Crédito</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Cliente</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
            <option value="">Selecione um cliente</option>
            {customersData?.items?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WalletEntryType)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(TYPE_LABEL) as WalletEntryType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Origem</label>
          <select
            value={originType}
            onChange={(e) => setOriginType(e.target.value as WalletOriginType)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {(Object.keys(ORIGIN_LABEL) as WalletOriginType[]).map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABEL[o]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Validade (opcional)
          </label>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Observações (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas sobre este voucher"
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar Voucher'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ──── Overview Table ──────────────────────────────────────────────────────────

function OverviewTable({
  items,
  onAdjust,
}: {
  items: WalletEntry[]
  onAdjust: (entry: WalletEntry) => void
}) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <Wallet className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          Nenhuma entrada encontrada
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Cliente</th>
            <th className="px-4 py-2.5 font-medium">Tipo</th>
            <th className="px-4 py-2.5 font-medium">Saldo</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Vencimento</th>
            <th className="px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5">
                <span className="font-medium text-foreground">{entry.customer.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{entry.code}</span>
              </td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[entry.type]}`}>
                  {TYPE_LABEL[entry.type]}
                </span>
              </td>
              <td className="px-4 py-2.5 font-semibold text-green-600">
                {formatCurrency(entry.balance)}
              </td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[entry.status]}`}>
                  {STATUS_LABEL[entry.status]}
                </span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {formatDate(entry.expirationDate)}
              </td>
              <td className="px-4 py-2.5">
                {entry.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => onAdjust(entry)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Ajustar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

export default function CarteiraPage() {
  const [viewMode, setViewMode] = useState<'overview' | 'by-customer'>('overview')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [adjustEntry, setAdjustEntry] = useState<WalletEntry | null>(null)

  const { data: customersData } = useCustomers({ limit: '200' })

  // Visão geral
  const overviewParams: Record<string, string> = {}
  if (statusFilter) overviewParams.status = statusFilter
  if (typeFilter) overviewParams.type = typeFilter
  const { data: overviewData, isLoading: overviewLoading } = useWalletOverview(
    Object.keys(overviewParams).length ? overviewParams : undefined,
    viewMode === 'overview',
  )

  // Por cliente
  const byCustomerParams: Record<string, string> = {}
  if (statusFilter) byCustomerParams.status = statusFilter
  if (typeFilter) byCustomerParams.type = typeFilter
  if (selectedCustomerId) byCustomerParams.customerId = selectedCustomerId
  const { data: byCustomerData, isLoading: byCustomerLoading } = useWallet(
    viewMode === 'by-customer' && selectedCustomerId ? byCustomerParams : undefined,
  )

  const isLoading = viewMode === 'overview' ? overviewLoading : byCustomerLoading
  const rawItems = viewMode === 'overview' ? (overviewData?.items ?? []) : (byCustomerData?.items ?? [])
  const total = viewMode === 'overview' ? (overviewData?.total ?? 0) : (byCustomerData?.total ?? 0)

  // Filtro client-side por nome na visão geral
  const displayItems = viewMode === 'overview' && customerSearch
    ? rawItems.filter((e) =>
        e.customer.name.toLowerCase().includes(customerSearch.toLowerCase()),
      )
    : rawItems

  const statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'ACTIVE', label: 'Ativos' },
    { value: 'USED', label: 'Utilizados' },
    { value: 'EXPIRED', label: 'Expirados' },
  ]

  const typeOptions = [
    { value: '', label: 'Todos os tipos' },
    { value: 'VOUCHER', label: 'Voucher' },
    { value: 'CREDIT', label: 'Crédito' },
    { value: 'CASHBACK', label: 'Cashback' },
    { value: 'PACKAGE', label: 'Pacote' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Carteira</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie vouchers, créditos, cashback e pacotes dos clientes
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Voucher
        </Button>
      </div>

      {/* Modo de visualização */}
      <div className="flex rounded-lg border overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setViewMode('overview')}
          className={[
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
            viewMode === 'overview'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-muted-foreground hover:bg-accent',
          ].join(' ')}
        >
          <LayoutList className="h-4 w-4" />
          Visão geral
        </button>
        <button
          type="button"
          onClick={() => setViewMode('by-customer')}
          className={[
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
            viewMode === 'by-customer'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-muted-foreground hover:bg-accent',
          ].join(' ')}
        >
          <Users className="h-4 w-4" />
          Por cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status pills — comuns aos dois modos */}
        <div className="flex gap-1">
          {statusOptions.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
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

        {/* Tipo */}
        <div className="flex gap-1">
          {typeOptions.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === t.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Visão geral — busca por cliente */}
        {viewMode === 'overview' && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar por cliente…"
              className="h-8 rounded-full border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Por cliente — seletor de cliente */}
        {viewMode === 'by-customer' && (
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="h-8 rounded-full border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Selecione um cliente…</option>
            {customersData?.items?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === 'overview' ? (
        <>
          <OverviewTable items={displayItems} onAdjust={setAdjustEntry} />
          {total > 20 && (
            <p className="text-center text-xs text-muted-foreground">
              Exibindo {displayItems.length} de {total} entradas
            </p>
          )}
        </>
      ) : !selectedCustomerId ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            Selecione um cliente para ver suas entradas
          </p>
        </div>
      ) : !displayItems.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            Nenhuma entrada encontrada para este cliente
          </p>
          <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
            Criar primeiro voucher
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayItems.map((entry) => (
              <div key={entry.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {entry.code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[entry.type]}`}
                      >
                        {TYPE_LABEL[entry.type]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[entry.status]}`}
                      >
                        {STATUS_LABEL[entry.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{entry.customer.name}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Origem: {ORIGIN_LABEL[entry.originType as WalletOriginType]}</span>
                      {entry.originReference && (
                        <span>Ref: {entry.originReference.slice(0, 8)}…</span>
                      )}
                      <span>Criado em {formatDate(entry.createdAt)}</span>
                      {entry.expirationDate && (
                        <span>Expira em {formatDate(entry.expirationDate)}</span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="mt-1 text-xs text-muted-foreground italic">{entry.notes}</p>
                    )}
                    <TransactionHistory entry={entry} />
                  </div>

                  {/* Right — balance */}
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(entry.balance)}
                    </p>
                    {entry.originalValue !== entry.balance && (
                      <p className="text-xs text-muted-foreground">
                        de {formatCurrency(entry.originalValue)}
                      </p>
                    )}
                    {entry.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => setAdjustEntry(entry)}
                        className="mt-2 text-xs font-medium text-primary hover:underline"
                      >
                        Ajustar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {byCustomerData && byCustomerData.total > byCustomerData.limit && (
            <p className="text-center text-xs text-muted-foreground">
              Exibindo {displayItems.length} de {byCustomerData.total} entradas
            </p>
          )}
        </>
      )}

      {/* Modals */}
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {adjustEntry && (
        <AdjustModal
          entry={adjustEntry}
          open={!!adjustEntry}
          onClose={() => setAdjustEntry(null)}
        />
      )}
    </div>
  )
}
