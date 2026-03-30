'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Cake, TrendingUp, AlertCircle, CheckCircle, Clock, Loader2, Sparkles, Users, Bot, RefreshCw, ShoppingCart, DollarSign, TrendingDown } from 'lucide-react'
import { useLedgerSummary, useTodayAppointments } from '@/lib/hooks/use-financial'
import { useCustomerBirthdays, useProductSales } from '@/lib/hooks/use-resources'
import { useBilling } from '@/lib/hooks/use-appointments'
import { useRole } from '@/lib/hooks/use-role'
import { api } from '@/lib/api'

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_COLOR: Record<string, string> = {
  draft:       'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  confirmed:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  in_progress: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  completed:   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  cancelled:   'bg-muted text-muted-foreground',
  no_show:     'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

// Monthly range helpers
function monthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

const FINANCIAL_LABELS = ['Receita Hoje', 'Receita do Mês', 'A Receber', 'Vendas (Mês)']

export default function DashboardPage() {
  const { from, to } = monthRange()
  const today = new Date().toISOString().slice(0, 10)
  const role = useRole()
  const isAdmin = role === 'admin'
  const summary = useLedgerSummary({ from, to }, { enabled: isAdmin })
  const todaySummary = useLedgerSummary({ from: today, to: today }, { enabled: isAdmin })
  const todayAppts = useTodayAppointments()
  const pendingBilling = useBilling({ status: 'pending' }, { enabled: isAdmin })
  const overdueBilling = useBilling({ status: 'overdue', limit: '5' }, { enabled: isAdmin })
  const monthSales = useProductSales({ from, to, limit: '1' }, { enabled: isAdmin })

  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const birthdays = useCustomerBirthdays(7)

  async function loadBriefing() {
    setBriefingLoading(true)
    try {
      const res = await api.post<{ briefing: string }>('/ai/briefing')
      setBriefing(res.data.briefing)
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string; error?: string } } })
        ?.response?.data?.message ??
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : null)
      setBriefing('Não foi possível gerar o briefing. ' + (errMsg ? `Erro: ${errMsg}` : 'Verifique se a chave GEMINI_API_KEY está configurada.'))
    } finally {
      setBriefingLoading(false)
    }
  }

  const todayStats = useMemo(() => {
    const appts = todayAppts.data ?? []
    return {
      total: appts.length,
      completed: appts.filter((a) => a.status === 'completed').length,
      inProgress: appts.filter((a) => a.status === 'in_progress').length,
      pending: appts.filter((a) => ['draft', 'confirmed'].includes(a.status)).length,
    }
  }, [todayAppts.data])

  const byProfessional = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; completed: number }>()
    for (const a of todayAppts.data ?? []) {
      const p = a.professional
      if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, total: 0, completed: 0 })
      const entry = map.get(p.id)!
      entry.total++
      if (a.status === 'completed') entry.completed++
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [todayAppts.data])

  const todayServicesCompleted = useMemo(
    () => (todayAppts.data ?? []).filter((a) => a.status === 'completed').length,
    [todayAppts.data],
  )

  const stats = [
    {
      label: 'Receita Hoje',
      value: todaySummary.isLoading ? '...' : formatCurrency(todaySummary.data?.totalCredits ?? 0),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/20',
    },
    {
      label: 'Receita do Mês',
      value: summary.isLoading ? '...' : formatCurrency(summary.data?.totalCredits ?? 0),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    },
    {
      label: 'Agendamentos Hoje',
      value: todayAppts.isLoading ? '...' : String(todayAppts.data?.length ?? 0),
      icon: CalendarDays,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      label: 'Serviços Concluídos',
      value: todayAppts.isLoading ? '...' : String(todayServicesCompleted),
      icon: CheckCircle,
      color: 'text-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-950/20',
    },
    {
      label: 'Vendas (Mês)',
      value: monthSales.isLoading ? '...' : String(monthSales.data?.total ?? 0),
      icon: ShoppingCart,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
    },
    {
      label: 'A Receber',
      value: pendingBilling.isLoading ? '...' : formatCurrency(pendingBilling.data?.totalAmount ?? 0),
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/20',
    },
  ]

  const visibleStats = isAdmin
    ? stats
    : stats.filter((s) => !FINANCIAL_LABELS.includes(s.label))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Início</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleStats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      {/* Briefing IA */}
      {isAdmin && (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-violet-50 p-2 dark:bg-violet-950/20">
            <Bot className="h-4 w-4 text-violet-600" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Briefing IA</h3>
          <button
            onClick={() => void loadBriefing()}
            disabled={briefingLoading}
            className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${briefingLoading ? 'animate-spin' : ''}`} />
            {briefing ? 'Atualizar' : 'Gerar briefing'}
          </button>
        </div>
        {briefingLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            Gerando briefing com IA...
          </div>
        )}
        {!briefingLoading && briefing && briefing.includes('GEMINI_API_KEY') && (
          <p className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
            ⚙️ A chave GEMINI_API_KEY não está configurada.{' '}
            <a href="/settings" className="font-medium underline underline-offset-2">
              Veja as instruções em Configurações → Integrações IA
            </a>
            .
          </p>
        )}
        {!briefingLoading && briefing && !briefing.includes('GEMINI_API_KEY') && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{briefing}</p>
        )}
        {!briefingLoading && !briefing && (
          <p className="mt-4 text-sm text-muted-foreground">Clique em "Gerar briefing" para ver um resumo inteligente do seu dia.</p>
        )}
      </div>
      )}

      {/* Briefing + Ocupação row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hoje em resumo */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-violet-50 p-2 dark:bg-violet-950/20">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Hoje em resumo</h3>
          </div>
          {todayAppts.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{todayStats.total}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Agendamentos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{todayStats.completed}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Concluídos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{todayStats.pending}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
              {todayStats.inProgress > 0 && (
                <p className="mt-4 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400">
                  ⚡ {todayStats.inProgress} atendimento(s) em andamento agora
                </p>
              )}
            </>
          )}
        </div>

        {/* Ocupação por profissional */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Ocupação por profissional</h3>
          </div>
          {todayAppts.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : byProfessional.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem agendamentos hoje</div>
          ) : (
            <div className="divide-y">
              {byProfessional.map(({ id, name, total, completed }) => (
                <div key={id} className="flex items-center gap-4 px-5 py-3">
                  <p className="flex-1 truncate text-sm font-medium text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground">{total} atend.</p>
                  <div className="w-20">
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-green-500"
                        style={{ width: `${total > 0 ? Math.round((completed / total) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-right text-xs text-muted-foreground">
                      {total > 0 ? Math.round((completed / total) * 100) : 0}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Birthday widget */}
      {(birthdays.data?.items.length ?? 0) > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <div className="rounded-lg bg-pink-50 p-2">
              <Cake className="h-4 w-4 text-pink-500" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Aniversariantes</h3>
            <span className="ml-auto rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
              próximos 7 dias
            </span>
          </div>
          <div className="divide-y">
            {birthdays.data?.items.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${b.isToday ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'}`}>
                  {b.isToday ? '🎂' : b.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.isToday ? '🎉 Aniversário hoje!' : `${new Date(b.birthDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                    {' · '}{b.age} anos
                    {b.phone && ` · ${b.phone}`}
                  </p>
                </div>
                {b.phone && (
                  <a
                    href={`https://wa.me/55${b.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${b.name.split(' ')[0]}! 🎂 Feliz aniversário! A equipe da clínica deseja muitas felicidades para você! 🎉`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's schedule */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Agenda de hoje</h3>
          <a href="/appointments" className="text-xs font-medium text-primary hover:underline">
            Ver tudo →
          </a>
        </div>
        <div className="divide-y">
          {todayAppts.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !todayAppts.data?.length ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum agendamento para hoje</p>
            </div>
          ) : (
            todayAppts.data.map((appt) => (
              <div key={appt.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex w-12 flex-col items-center text-center">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="mt-0.5 text-xs font-semibold text-foreground">
                    {formatTime(appt.scheduledAt)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{appt.customer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appt.service.name} · {appt.professional.name}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[appt.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABEL[appt.status] ?? appt.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
