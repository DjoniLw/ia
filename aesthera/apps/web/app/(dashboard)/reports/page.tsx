'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Loader2, Users, Package, ShoppingCart, TrendingDown, TrendingUp, BarChart3, Scissors } from 'lucide-react'
import { useCustomers, useProducts, useProductSales } from '@/lib/hooks/use-resources'
import { useAppointments } from '@/lib/hooks/use-appointments'
import { useLedgerSummary } from '@/lib/hooks/use-financial'

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatPieLabel(name: string | undefined, valueStr: string) {
  return `${name ?? ''} ${valueStr}`
}

function monthRange() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  }
}

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

type ReportTab = 'clients' | 'products' | 'services' | 'stock'

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('clients')
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)

  // Data fetching
  const { data: customersData, isLoading: customersLoading } = useCustomers({ limit: '200' })
  const { data: productsData, isLoading: productsLoading } = useProducts({ limit: '200' })
  const { data: salesData, isLoading: salesLoading } = useProductSales({ from, to, limit: '500' })
  const { data: apptData, isLoading: apptLoading } = useAppointments({ dateFrom: from, dateTo: to, limit: '500', status: 'completed' })
  const { data: summary } = useLedgerSummary({ from, to })

  // ── Clients stats ────────────────────────────────────────────────────────────
  const clientStats = useMemo(() => {
    const customers = customersData?.items ?? []
    const withBirth = customers.filter((c) => c.birthDate)
    const withPhone = customers.filter((c) => c.phone)
    const byMonth = new Map<string, number>()
    customers.forEach((c) => {
      const d = new Date(c.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
    })
    const chartData = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, count]) => ({
        label: new Date(key + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        clientes: count,
      }))
    return { total: customers.length, withBirth: withBirth.length, withPhone: withPhone.length, chartData }
  }, [customersData])

  // ── Products sold stats ──────────────────────────────────────────────────────
  const productSaleStats = useMemo(() => {
    const sales = salesData?.items ?? []
    const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>()
    sales.forEach((s) => {
      const existing = byProduct.get(s.product.id) ?? { name: s.product.name, quantity: 0, revenue: 0 }
      existing.quantity += s.quantity
      existing.revenue += s.totalPrice
      byProduct.set(s.product.id, existing)
    })
    const sorted = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

    const byPayment = new Map<string, number>()
    sales.forEach((s) => {
      const method = s.paymentMethod ?? 'Não informado'
      const label = { cash: 'Dinheiro', pix: 'PIX', card: 'Cartão', transfer: 'Transferência' }[method] ?? method
      byPayment.set(label, (byPayment.get(label) ?? 0) + s.totalPrice)
    })
    const paymentChart = [...byPayment.entries()].map(([name, value]) => ({ name, value }))

    const totalRevenue = sales.reduce((sum, s) => sum + s.totalPrice, 0)
    const totalItems = sales.reduce((sum, s) => sum + s.quantity, 0)

    return { sorted, paymentChart, totalRevenue, totalItems, totalSales: sales.length }
  }, [salesData])

  // ── Service stats ────────────────────────────────────────────────────────────
  const serviceStats = useMemo(() => {
    const appts = apptData?.items ?? []
    const byService = new Map<string, { name: string; count: number; revenue: number; category: string | null }>()
    appts.forEach((a) => {
      const s = a.service
      const existing = byService.get(s.id) ?? { name: s.name, count: 0, revenue: 0, category: s.category ?? null }
      existing.count++
      existing.revenue += a.price
      byService.set(s.id, existing)
    })
    const sorted = [...byService.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

    const byProfessional = new Map<string, { name: string; count: number; revenue: number }>()
    appts.forEach((a) => {
      const p = a.professional
      const existing = byProfessional.get(p.id) ?? { name: p.name, count: 0, revenue: 0 }
      existing.count++
      existing.revenue += a.price
      byProfessional.set(p.id, existing)
    })
    const byProfSorted = [...byProfessional.values()].sort((a, b) => b.count - a.count)

    const totalRevenue = appts.reduce((sum, a) => sum + a.price, 0)
    return { sorted, byProfSorted, totalRevenue, totalAppts: appts.length }
  }, [apptData])

  // ── Stock stats ──────────────────────────────────────────────────────────────
  const stockStats = useMemo(() => {
    const products = productsData?.items ?? []
    const active = products.filter((p) => p.active)
    const lowStock = active.filter((p) => p.stock <= p.minStock && p.minStock > 0)
    const outOfStock = active.filter((p) => p.stock === 0)
    const sorted = [...active].sort((a, b) => a.stock - b.stock).slice(0, 20)
    const byCategory = new Map<string, number>()
    active.forEach((p) => {
      const cat = p.category ?? 'Sem categoria'
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1)
    })
    const categoryChart = [...byCategory.entries()].map(([name, value]) => ({ name, value }))
    return { total: active.length, lowStock: lowStock.length, outOfStock: outOfStock.length, sorted, categoryChart }
  }, [productsData])

  const tabs: { id: ReportTab; label: string; icon: typeof Users }[] = [
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'products', label: 'Vendas', icon: ShoppingCart },
    { id: 'services', label: 'Serviços', icon: Scissors },
    { id: 'stock', label: 'Estoque', icon: Package },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Relatórios</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Análise de clientes, vendas e estoque</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-muted/30 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
              tab === id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Date range (for sales and services tabs) */}
      {(tab === 'products' || tab === 'services') && (
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* ── Clients Tab ─────────────────────────────────────────────────────── */}
      {tab === 'clients' && (
        <div className="space-y-4">
          {customersLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <p className="text-sm text-muted-foreground">Total de clientes</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{clientStats.total}</p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <p className="text-sm text-muted-foreground">Com telefone cadastrado</p>
                  <p className="mt-2 text-3xl font-bold text-blue-600">{clientStats.withPhone}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {clientStats.total > 0 ? Math.round((clientStats.withPhone / clientStats.total) * 100) : 0}% do total
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <p className="text-sm text-muted-foreground">Com data de nascimento</p>
                  <p className="mt-2 text-3xl font-bold text-pink-600">{clientStats.withBirth}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {clientStats.total > 0 ? Math.round((clientStats.withBirth / clientStats.total) * 100) : 0}% do total
                  </p>
                </div>
              </div>

              {clientStats.chartData.length > 0 && (
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Novos clientes por mês</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={clientStats.chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                      <Bar dataKey="clientes" name="Novos clientes" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Client list */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="border-b px-5 py-4">
                  <h3 className="text-sm font-semibold text-foreground">Lista de clientes</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3">Nome</th>
                        <th className="px-5 py-3">Telefone</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Nascimento</th>
                        <th className="px-5 py-3">Cadastro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {customersData?.items.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
                          <td className="px-5 py-3 text-muted-foreground">{c.phone ?? '—'}</td>
                          <td className="px-5 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {c.birthDate ? new Date(c.birthDate).toLocaleDateString('pt-BR') : '—'}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Sales Tab ───────────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="space-y-4">
          {salesLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-muted-foreground">Receita de vendas</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(productSaleStats.totalRevenue)}</p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <p className="text-sm text-muted-foreground">Receita total (ledger)</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-blue-600">{formatCurrency(summary?.totalCredits ?? 0)}</p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <p className="text-sm text-muted-foreground">Transações</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{productSaleStats.totalSales}</p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <p className="text-sm text-muted-foreground">Itens vendidos</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{productSaleStats.totalItems}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Top products by revenue */}
                {productSaleStats.sorted.length > 0 && (
                  <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">Produtos mais vendidos (receita)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={productSaleStats.sorted} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$${(v/100).toFixed(0)}`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip formatter={(v: unknown) => [formatCurrency(v as number), 'Receita']} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                        <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Payment methods pie */}
                {productSaleStats.paymentChart.length > 0 && (
                  <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">Formas de pagamento</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={productSaleStats.paymentChart}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={(p: { name?: string; percent?: number }) =>
                            formatPieLabel(p.name, `${((p.percent ?? 0) * 100).toFixed(0)}%`)
                          }
                          labelLine={false}
                        >
                          {productSaleStats.paymentChart.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend formatter={(v: string) => <span className="text-xs">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Top products table */}
              {productSaleStats.sorted.length > 0 && (
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="border-b px-5 py-4">
                    <h3 className="text-sm font-semibold text-foreground">Top produtos vendidos</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3">Produto</th>
                        <th className="px-5 py-3 text-right">Qtd vendida</th>
                        <th className="px-5 py-3 text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {productSaleStats.sorted.map((p, i) => (
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-medium text-foreground">{p.name}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{p.quantity}</td>
                          <td className="px-5 py-3 text-right font-semibold text-green-600">{formatCurrency(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Services Tab ──────────────────────────────────────────────────── */}
      {tab === 'services' && (
        <div className="space-y-4">
          {apptLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-muted-foreground">Receita de serviços</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(serviceStats.totalRevenue)}</p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <p className="text-sm text-muted-foreground">Atendimentos concluídos</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{serviceStats.totalAppts}</p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <p className="text-sm text-muted-foreground">Serviços distintos</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{serviceStats.sorted.length}</p>
                </div>
              </div>

              {serviceStats.sorted.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Top services by revenue */}
                  <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">Serviços mais rentáveis</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={serviceStats.sorted} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$${(v/100).toFixed(0)}`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                        <Tooltip formatter={(v: unknown) => [formatCurrency(v as number), 'Receita']} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                        <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Revenue by professional */}
                  {serviceStats.byProfSorted.length > 0 && (
                    <div className="rounded-xl border bg-card p-5 shadow-sm">
                      <h3 className="mb-4 text-sm font-semibold text-foreground">Atendimentos por profissional</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={serviceStats.byProfSorted.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                          <Tooltip formatter={(v: unknown) => [`${v} atend.`, 'Total']} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                          <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Services table */}
              {serviceStats.sorted.length > 0 && (
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="border-b px-5 py-4">
                    <h3 className="text-sm font-semibold text-foreground">Detalhamento por serviço</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3">Serviço</th>
                        <th className="px-5 py-3">Categoria</th>
                        <th className="px-5 py-3 text-right">Qtd</th>
                        <th className="px-5 py-3 text-right">Receita</th>
                        <th className="px-5 py-3 text-right">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {serviceStats.sorted.map((s, i) => (
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                          <td className="px-5 py-3 text-muted-foreground">{s.category ?? '—'}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{s.count}</td>
                          <td className="px-5 py-3 text-right font-semibold text-green-600">{formatCurrency(s.revenue)}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(s.count > 0 ? Math.round(s.revenue / s.count) : 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {serviceStats.sorted.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-16 text-center">
                  <Scissors className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhum serviço concluído no período</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Stock Tab ───────────────────────────────────────────────────────── */}
      {tab === 'stock' && (
        <div className="space-y-4">
          {productsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <p className="text-sm text-muted-foreground">Produtos ativos</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stockStats.total}</p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-yellow-500" />
                    <p className="text-sm text-muted-foreground">Estoque baixo</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-yellow-600">{stockStats.lowStock}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Abaixo do mínimo</p>
                </div>
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-muted-foreground">Sem estoque</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-red-600">{stockStats.outOfStock}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Category distribution */}
                {stockStats.categoryChart.length > 0 && (
                  <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">Produtos por categoria</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={stockStats.categoryChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={(p: { name?: string; value?: number }) => formatPieLabel(p.name, `(${p.value ?? 0})`)} labelLine={false}>
                          {stockStats.categoryChart.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend formatter={(v: string) => <span className="text-xs">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Critical stock */}
                {stockStats.lowStock + stockStats.outOfStock > 0 && (
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-950/10 p-5">
                    <h3 className="mb-3 text-sm font-semibold text-yellow-800 dark:text-yellow-300">⚠️ Reposição necessária</h3>
                    <div className="space-y-2">
                      {productsData?.items
                        .filter((p) => p.active && p.stock <= p.minStock && p.minStock > 0)
                        .slice(0, 8)
                        .map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-yellow-900 dark:text-yellow-200">{p.name}</span>
                            <span className={`font-bold ${p.stock === 0 ? 'text-red-600' : 'text-yellow-700'}`}>
                              {p.stock} / mín {p.minStock} {p.unit}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Full stock table */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="border-b px-5 py-4">
                  <h3 className="text-sm font-semibold text-foreground">Posição de estoque</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3">Produto</th>
                        <th className="px-5 py-3">Categoria</th>
                        <th className="px-5 py-3">SKU</th>
                        <th className="px-5 py-3 text-right">Estoque</th>
                        <th className="px-5 py-3 text-right">Mínimo</th>
                        <th className="px-5 py-3 text-right">Preço</th>
                        <th className="px-5 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stockStats.sorted.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-medium text-foreground">{p.name}</td>
                          <td className="px-5 py-3 text-muted-foreground">{p.category ?? '—'}</td>
                          <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{p.sku ?? '—'}</td>
                          <td className={`px-5 py-3 text-right font-semibold ${p.stock === 0 ? 'text-red-600' : p.stock <= p.minStock && p.minStock > 0 ? 'text-yellow-600' : 'text-foreground'}`}>
                            {p.stock} {p.unit}
                          </td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{p.minStock}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(p.price)}</td>
                          <td className="px-5 py-3 text-center">
                            {p.stock === 0 ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Sem estoque</span>
                            ) : p.minStock > 0 && p.stock <= p.minStock ? (
                              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Baixo</span>
                            ) : (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
