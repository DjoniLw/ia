'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { CheckCircle, Clock, XCircle, Loader2, CreditCard } from 'lucide-react'
import { apiBaseUrl } from '@/lib/api'

const API_URL = apiBaseUrl

interface PaymentPageData {
  id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  dueDate: string | null
  paymentToken: string
  paymentLink: string | null
  appointment?: {
    scheduledAt: string
    service: { name: string }
    professional: { name: string }
  }
  customer?: { name: string; email: string | null }
  clinic?: { name: string }
  payment?: { paymentUrl: string | null; pixQrCode: string | null; status: string } | null
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PayPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PaymentPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    axios
      .get<PaymentPageData>(`${API_URL}/pay/${token}`)
      .then((res) => setData(res.data))
      .catch(() => setError('Cobrança não encontrada ou expirada.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleMockPay() {
    if (!data?.payment?.paymentUrl) return
    setPaying(true)
    try {
      // PaymentUrl for mock = API_URL/payments/mock/pay/{id}
      const url = data.payment.paymentUrl.replace(API_URL, API_URL)
      await axios.post(url)
      setPaid(true)
      setData((prev) => prev ? { ...prev, status: 'paid' } : prev)
    } catch {
      setError('Erro ao processar pagamento. Tente novamente.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-10 shadow text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-semibold text-gray-800">{error ?? 'Cobrança não encontrada.'}</p>
        </div>
      </div>
    )
  }

  const isPaid = data.status === 'paid' || paid
  const isMock = data.payment?.paymentUrl?.includes('/payments/mock/pay/')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-white px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-5 text-white">
          <p className="text-sm font-medium opacity-80">{data.clinic?.name ?? 'Aesthera'}</p>
          <h1 className="mt-1 text-2xl font-bold">{formatCurrency(data.amount)}</h1>
          <p className="mt-1 text-sm opacity-75">
            {data.dueDate ? `Vence em ${new Date(data.dueDate).toLocaleDateString('pt-BR')}` : ''}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          {/* Customer */}
          {data.customer && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</p>
              <p className="mt-0.5 text-sm font-medium text-gray-800">{data.customer.name}</p>
            </div>
          )}

          {/* Service info */}
          {data.appointment && (
            <>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Serviço</p>
                <p className="mt-0.5 text-sm font-medium text-gray-800">{data.appointment.service.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Profissional</p>
                <p className="mt-0.5 text-sm font-medium text-gray-800">{data.appointment.professional.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data/Hora</p>
                <p className="mt-0.5 text-sm font-medium text-gray-800">
                  {formatDate(data.appointment.scheduledAt)}
                </p>
              </div>
            </>
          )}

          <hr className="border-gray-100" />

          {/* Status / CTA */}
          {isPaid ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold text-gray-800">Pagamento confirmado!</p>
              <p className="text-sm text-muted-foreground">Obrigado. Até logo!</p>
            </div>
          ) : data.status === 'cancelled' ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <XCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-base font-medium text-muted-foreground">Esta cobrança foi cancelada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.payment?.pixQrCode && (
                <div className="rounded-lg border bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    PIX Copia e Cola
                  </p>
                  <code className="block break-all text-xs text-gray-700">{data.payment.pixQrCode}</code>
                </div>
              )}

              {isMock && (
                <button
                  onClick={handleMockPay}
                  disabled={paying}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-70"
                >
                  {paying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {paying ? 'Processando...' : 'Simular Pagamento (Dev)'}
                </button>
              )}

              {!isMock && data.payment?.paymentUrl && (
                <a
                  href={data.payment.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  <CreditCard className="h-4 w-4" />
                  Ir para pagamento
                </a>
              )}

              {!data.payment?.paymentUrl && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
                  <Clock className="h-4 w-4 shrink-0" />
                  Aguardando geração do link de pagamento...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Powered by Aesthera</p>
    </div>
  )
}
