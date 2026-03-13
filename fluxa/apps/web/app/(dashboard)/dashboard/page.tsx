'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CheckCircle2, Clock, FileText, TrendingUp } from 'lucide-react'

interface DashboardSummary {
  invoices: {
    total: number
    pending: number
    paid: number
    overdue: number
  }
  revenue: {
    thisMonth: number
    pending: number
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/summary')
      return data
    },
  })

  const stats = [
    {
      title: 'Cobranças este mês',
      value: isLoading ? '—' : String(summary?.invoices.total ?? 0),
      icon: FileText,
      description: 'total geradas',
    },
    {
      title: 'Pendentes',
      value: isLoading ? '—' : String(summary?.invoices.pending ?? 0),
      icon: Clock,
      description: 'aguardando pagamento',
    },
    {
      title: 'Pagas',
      value: isLoading ? '—' : String(summary?.invoices.paid ?? 0),
      icon: CheckCircle2,
      description: 'recebidas com sucesso',
    },
    {
      title: 'Receita do mês',
      value: isLoading ? '—' : formatCurrency(summary?.revenue.thisMonth ?? 0),
      icon: TrendingUp,
      description: 'total recebido',
    },
    {
      title: 'A receber',
      value: isLoading ? '—' : formatCurrency(summary?.revenue.pending ?? 0),
      icon: BarChart3,
      description: 'cobranças pendentes',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Visão geral da sua plataforma de billing</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
