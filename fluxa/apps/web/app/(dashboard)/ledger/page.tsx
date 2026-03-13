'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'

interface LedgerEntry {
  id: string
  type: 'credit' | 'debit'
  amount: number
  description: string
  createdAt: string
}

interface LedgerSummary {
  totalCredits: number
  totalDebits: number
  netBalance: number
  entries: LedgerEntry[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(date),
  )
}

export default function LedgerPage() {
  const { data, isLoading } = useQuery<LedgerSummary>({
    queryKey: ['ledger'],
    queryFn: async () => {
      const { data } = await api.get('/ledger/summary')
      return data
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Financeiro</h2>
        <p className="text-muted-foreground">Registro financeiro imutável</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total recebido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {isLoading ? '—' : formatCurrency(data?.totalCredits ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total debitado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">
              {isLoading ? '—' : formatCurrency(data?.totalDebits ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? '—' : formatCurrency(data?.netBalance ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : !data?.entries?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhum lançamento ainda</p>
              <p className="text-sm text-muted-foreground">
                Os lançamentos serão criados automaticamente com os pagamentos
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {entry.type === 'credit' ? '+' : '-'} {formatCurrency(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
