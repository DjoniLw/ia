'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'

interface Payment {
  id: string
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  gateway: 'stripe' | 'mercadopago'
  method: string
  createdAt: string
  invoice: { id: string; customer: { name: string } }
}

const statusLabel: Record<Payment['status'], string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
}

const statusColor: Record<Payment['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-500',
}

const gatewayLabel: Record<Payment['gateway'], string> = {
  stripe: 'Stripe',
  mercadopago: 'MercadoPago',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(date),
  )
}

export default function PaymentsPage() {
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data } = await api.get('/payments')
      return data.data ?? data
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pagamentos</h2>
        <p className="text-muted-foreground">Histórico de pagamentos recebidos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CreditCard className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhum pagamento encontrado</p>
              <p className="text-sm text-muted-foreground">
                Os pagamentos aparecerão aqui após os clientes pagarem suas cobranças
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{payment.invoice.customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {gatewayLabel[payment.gateway]} · {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[payment.status]}`}
                    >
                      {statusLabel[payment.status]}
                    </span>
                    <span className="text-sm font-semibold">{formatCurrency(payment.amount)}</span>
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
