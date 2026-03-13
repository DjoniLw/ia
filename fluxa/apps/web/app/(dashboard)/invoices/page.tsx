'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { FileText, Plus } from 'lucide-react'

interface Invoice {
  id: string
  amount: number
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled'
  dueDate: string
  customer: { name: string; email: string }
  createdAt: string
}

const statusLabel: Record<Invoice['status'], string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
}

const statusColor: Record<Invoice['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export default function InvoicesPage() {
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await api.get('/invoices')
      return data.data ?? data
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cobranças</h2>
          <p className="text-muted-foreground">Gerencie suas cobranças</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova cobrança
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de cobranças</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhuma cobrança encontrada</p>
              <p className="text-sm text-muted-foreground">
                Crie sua primeira cobrança clicando em &quot;Nova cobrança&quot;
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{invoice.customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence em {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[invoice.status]}`}
                    >
                      {statusLabel[invoice.status]}
                    </span>
                    <span className="text-sm font-semibold">{formatCurrency(invoice.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
