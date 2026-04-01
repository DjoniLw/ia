'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, DollarSign, QrCode, Wallet } from 'lucide-react'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  useReceivePayment,
  useActiveVouchers,
  type WalletEntry,
} from '@/lib/hooks/use-wallet'
import type { Billing } from '@/lib/hooks/use-appointments'

// ──── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

const ORIGIN_LABEL: Record<string, string> = {
  OVERPAYMENT: 'Troco',
  GIFT: 'Presente',
  REFUND: 'Estorno',
  CASHBACK_PROMOTION: 'Cashback',
  PACKAGE_PURCHASE: 'Pacote',
  VOUCHER_SPLIT: 'Divisão de voucher',
}

// ──── Payment Method Button ───────────────────────────────────────────────────

interface MethodOption {
  value: 'cash' | 'pix' | 'card' | 'voucher'
  label: string
  icon: React.ReactNode
}

const methods: MethodOption[] = [
  { value: 'cash', label: 'Dinheiro', icon: <DollarSign className="h-4 w-4" /> },
  { value: 'pix', label: 'PIX', icon: <QrCode className="h-4 w-4" /> },
  { value: 'card', label: 'Cartão', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'voucher', label: 'Voucher', icon: <Wallet className="h-4 w-4" /> },
]

// ──── Modal ───────────────────────────────────────────────────────────────────

interface PaymentModalProps {
  billing: Billing
  open: boolean
  onClose: () => void
}

export function PaymentModal({ billing, open, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<'cash' | 'pix' | 'card' | 'voucher'>('cash')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [selectedVoucher, setSelectedVoucher] = useState<string>('')

  const { data: walletData } = useActiveVouchers(billing.customer.id, method === 'voucher')
  const activeVouchers: WalletEntry[] = walletData?.items ?? []

  const receive = useReceivePayment(billing.id)

  const billingAmountBrl = billing.amount / 100
  const receivedBrl = parseFloat(receivedAmount || '0')
  const overpayment = receivedBrl * 100 - billing.amount
  const selectedVoucherEntry = activeVouchers.find((v) => v.id === selectedVoucher)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const amountCents =
      method === 'voucher'
        ? selectedVoucherEntry?.balance ?? 0
        : Math.round(parseFloat(receivedAmount) * 100)

    if (method !== 'voucher' && amountCents < billing.amount) {
      toast.error('Valor recebido é menor que o valor da cobrança')
      return
    }
    if (method === 'voucher' && !selectedVoucher) {
      toast.error('Selecione um voucher')
      return
    }

    try {
      const result = await receive.mutateAsync({
        method,
        receivedAmount: amountCents,
        voucherId: method === 'voucher' ? selectedVoucher : undefined,
      })

      if (result.status === 'partial') {
        toast.warning(
          `Voucher cobre apenas ${formatCurrency(result.coveredAmount)}. Faltam ${formatCurrency(result.remainingAmount)}.`,
        )
        return
      }

      if (result.walletEntry) {
        toast.success(
          `Cobrança paga! Voucher de troco gerado: ${result.walletEntry.code} (${formatCurrency(result.walletEntry.balance)})`,
        )
      } else {
        toast.success('Pagamento registrado com sucesso!')
      }
      onClose()
    } catch {
      toast.error('Erro ao registrar pagamento')
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Registrar Recebimento</DialogTitle>

      {/* Billing summary */}
      <div className="mb-5 rounded-lg border bg-muted/30 p-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cliente</span>
          <span className="font-medium">{billing.customer.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Serviço</span>
          <span className="font-medium">{billing.appointment?.service?.name ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor da cobrança</span>
          <span className="text-lg font-bold text-foreground">{formatCurrency(billing.amount)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Payment method */}
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Forma de pagamento</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {methods.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setMethod(m.value)
                  setSelectedVoucher('')
                  setReceivedAmount('')
                }}
                className={[
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors',
                  method === m.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-card text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voucher selector */}
        {method === 'voucher' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Selecionar Voucher
            </label>
            {activeVouchers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum voucher ativo para este cliente.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeVouchers.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVoucher(v.id)}
                    className={[
                      'w-full rounded-lg border p-3 text-left text-sm transition-colors',
                      selectedVoucher === v.id
                        ? 'border-primary bg-primary/10'
                        : 'border-input bg-card hover:bg-accent',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-foreground">{v.code}</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(v.balance)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {ORIGIN_LABEL[v.originType] ?? v.originType}
                      {v.expirationDate &&
                        ` · Expira em ${new Date(v.expirationDate).toLocaleDateString('pt-BR')}`}
                    </div>
                    {selectedVoucher === v.id && v.balance < billing.amount && (
                      <p className="mt-1 text-xs text-yellow-600">
                        Saldo insuficiente — faltam {formatCurrency(billing.amount - v.balance)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Received amount */}
        {method !== 'voucher' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Valor recebido (R$)
            </label>
            <input
              type="number"
              min={billingAmountBrl}
              step="0.01"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              placeholder={billingAmountBrl.toFixed(2)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            {/* Overpayment warning */}
            {overpayment > 0 && (
              <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
                <strong>Troco: {formatCurrency(overpayment)}</strong>
                <br />
                Um voucher será gerado automaticamente para o troco.
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={receive.isPending}>
            {receive.isPending ? 'Registrando…' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
