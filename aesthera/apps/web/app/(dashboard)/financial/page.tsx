'use client'

import { useMemo, useState, useEffect, Suspense } from 'react'
import { Info, Loader2, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useLedger, useLedgerChart, useLedgerSummary } from '@/lib/hooks/use-financial'
import type { LedgerEntry } from '@/lib/hooks/use-financial'

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function currentMonthFrom() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function currentMonthTo() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function buildFilterLabel(type: 'credit' | 'debit' | '', from: string, to: string): string {
  const parts: string[] = []

  const defFrom = currentMonthFrom()
  const defTo = currentMonthTo()

  if (from === defFrom && to === defTo) {
    parts.push('mês atual')
  } else if (from && to) {
    parts.push(`de ${formatDate(from)} até ${formatDate(to)}`)
  } else if (from) {
    parts.push(`a partir de ${formatDate(from)}`)
  } else {
    parts.push('todo o período')
  }

  const typeLabel: Record<string, string> = {
    '': 'todos os tipos',
    credit: 'Crédito',
    debit: 'Débito',
  }
  parts.push(typeLabel[type] ?? type)

  return parts.join(' · ')
}

function buildChartData(items: LedgerEntry[], from: string, to: string) {
  const diffDays = Math.ceil(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24),
  )
  const byWeek = diffDays > 45
  const map = new Map<string, { label: string; receita: number; despesa: number }>()

  items.forEach((item) => {
    const d = new Date(item.createdAt)
    let key: string
    let label: string
    if (byWeek) {
      const dow = d.getDay() || 7
      const monday = new Date(d)
      monday.setDate(d.getDate() - dow + 1)
      key = monday.toISOString().slice(0, 10)
      label = monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } else {
      key = d.toISOString().slice(0, 10)
      label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
    if (!map.has(key)) map.set(key, { label, receita: 0, despesa: 0 })
    const entry = map.get(key)!
    if (item.type === 'credit') entry.receita += item.amount / 100
    else entry.despesa += item.amount / 100
  })

  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
}

function FinancialPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [from, setFrom] = useState(searchParams.get('from') ?? currentMonthFrom())
  const [to, setTo] = useState(searchParams.get('to') ?? currentMonthTo())
  const [type, setType] = useState<'credit' | 'debit' | ''>((searchParams.get('type') as 'credit' | 'debit' | '') ?? '')
  const [page, setPage] = useState(1)

  const isDefaultFilters = from === currentMonthFrom() && to === currentMonthTo() && type === ''

  function resetFilters() {
    setFrom(currentMonthFrom())
    setTo(currentMonthTo())
    setType('')
    setPage(1)
  }

  function applyPreset(preset: 'today' | 7 | 30 | '6months' | '1year') {
    const today = toISODate(new Date())
    if (preset === 'today') {
      setFrom(today)
      setTo(today)
    } else if (preset === '6months') {
      const d = new Date()
      d.setMonth(d.getMonth() - 6)
      setFrom(toISODate(d))
      setTo(today)
    } else if (preset === '1year') {
      const d = new Date()
      d.setFullYear(d.getFullYear() - 1)
      setFrom(toISODate(d))
      setTo(today)
    } else {
      const d = new Date()
      d.setDate(d.getDate() - preset)
      setFrom(toISODate(d))
      setTo(today)
    }
    setPage(1)
  }

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (type) p.set('type', type)
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, from, to, type])

  const params = Object.fromEntries(
    Object.entries({ from, to, type, page, limit: 20 }).filter(([, v]) => v !== ''),
  )

  const { data, isLoading } = useLedger(params)
  const { data: summary, isLoading: summaryLoading } = useLedgerSummary({ from, to })
  const { data: chartRaw } = useLedgerChart({ from, to })

  const diffDays = Math.ceil(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24),
  )
  const chartData = useMemo(
    () => buildChartData(chartRaw?.items ?? [], from, to),
    [chartRaw, from, to],
  )

  const summaryCards = [
    {
      label: 'Receitas',
      value: summaryLoading ? '...' : formatCurrency(summary?.totalCredits ?? 0),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/20',
      count: summary?.creditCount ?? 0,
    },
    {
      label: 'Despesas',
      value: summaryLoading ? '...' : formatCurrency(summary?.totalDebits ?? 0),
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/20',
      count: summary?.debitCount ?? 0,
    },
    {
      label: 'Saldo Líquido',
      value: summaryLoading ? '...' : formatCurrency(summary?.netBalance ?? 0),
      icon: DollarSign,
      color: (summary?.netBalance ?? 0) >= 0 ? 'text-violet-600' : 'text-red-600',
      bg: 'bg-violet-50 dark:bg-violet-950/20',
      count: (summary?.creditCount ?? 0) + (summary?.debitCount ?? 0),
    },
  ]

  const typeOptions: Array<{ value: 'credit' | 'debit' | ''; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'credit', label: 'Crédito' },
    { value: 'debit', label: 'Débito' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Financeiro</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Histórico de lançamentos do caixa</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {summaryCards.map(({ label, value, icon: Icon, color, bg, count }) => (
          <div key={label} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{count} lançamento(s)</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Receita vs Despesas</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {diffDays > 45 ? 'por semana' : 'por dia'}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `R$${v}`}
              />
              <Tooltip
                formatter={(value: unknown) => [formatCurrency((value as number) * 100), '']}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="receita" name="Receitas" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesas" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets de data */}
          <div className="flex flex-wrap gap-1">
            {(
              [
                { label: 'Hoje', preset: 'today' },
                { label: '7 dias', preset: 7 },
                { label: '30 dias', preset: 30 },
                { label: '6 meses', preset: '6months' },
                { label: '1 ano', preset: '1year' },
              ] as const
            ).map(({ label, preset }) => (
              <button
                key={label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-input bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground">De</label>
              <input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(1) }}
                className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground">Até</label>
              <input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setPage(1) }}
                className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Tipo pills */}
          <div className="flex gap-1">
            {typeOptions.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setType(t.value); setPage(1) }}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  type === t.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legenda descritiva */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Exibindo {buildFilterLabel(type, from, to)}</span>
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
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Lançamentos</h3>
          {data && (
            <span className="ml-auto text-xs text-muted-foreground">{data.total} no total</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum lançamento no período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="hidden sm:table-cell px-5 py-3">Descrição</th>
                  <th className="hidden sm:table-cell px-5 py-3">Cliente</th>
                  <th className="hidden sm:table-cell px-5 py-3">Serviço</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.type === 'credit'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {entry.type === 'credit' ? 'Crédito' : 'Débito'}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-foreground">{entry.description ?? '—'}</td>
                    <td className="hidden sm:table-cell px-5 py-3 text-muted-foreground">{entry.customer?.name ?? '—'}</td>
                    <td className="hidden sm:table-cell px-5 py-3 text-muted-foreground">
                      {entry.appointment?.service.name ?? '—'}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-semibold ${
                        entry.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {entry.type === 'credit' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Página {data.page} de {Math.ceil(data.total / data.limit)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-muted/50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.total / data.limit)}
                className="rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-muted/50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FinancialPage() {
  return (
    <Suspense>
      <FinancialPageContent />
    </Suspense>
  )
}
