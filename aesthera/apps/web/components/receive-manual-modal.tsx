'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveVouchers, type WalletEntry } from '@/lib/hooks/use-wallet'
import {
  useCreateManualReceipt,
  type ManualReceiptPaymentMethod,
  type OverpaymentHandlingType,
} from '@/lib/hooks/use-appointments'
import type { Billing } from '@/lib/hooks/use-appointments'

// ──── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function parseCurrencyInput(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (!normalized) return 0
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

const PAYMENT_METHODS: Array<{ value: ManualReceiptPaymentMethod; label: string }> = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'card', label: 'Cartão' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'wallet_credit', label: 'Crédito na Carteira' },
  { value: 'wallet_voucher', label: 'Vale' },
]

// ──── Payment Line ────────────────────────────────────────────────────────────

interface PaymentLineState {
  id: number
  method: ManualReceiptPaymentMethod
  amountStr: string
  walletEntryId: string
}

interface PaymentLineRowProps {
  line: PaymentLineState
  customerId: string
  canRemove: boolean
  onUpdate: (updated: Partial<PaymentLineState>) => void
  onRemove: () => void
}

function PaymentLineRow({
  line,
  customerId,
  canRemove,
  onUpdate,
  onRemove,
}: PaymentLineRowProps) {
  const isWallet = line.method === 'wallet_credit' || line.method === 'wallet_voucher'
  const { data: walletData } = useActiveVouchers(customerId, isWallet)
  const activeEntries: WalletEntry[] = walletData?.items ?? []

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <select
            value={line.method}
            onChange={(e) =>
              onUpdate({ method: e.target.value as ManualReceiptPaymentMethod, walletEntryId: '' })
            }
            className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <Input
            value={line.amountStr}
            onChange={(e) => onUpdate({ amountStr: e.target.value })}
            placeholder="0,00"
            className="h-9 w-32 text-sm"
          />
        </div>

        {isWallet && (
          <div>
            {activeEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum item de carteira ativo para este cliente.
              </p>
            ) : (
              <select
                value={line.walletEntryId}
                onChange={(e) => onUpdate({ walletEntryId: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Selecione um item da carteira…</option>
                {activeEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} — {formatCurrency(e.balance)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-0.5 h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Minus className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

// ──── Overpayment Section ─────────────────────────────────────────────────────

interface OverpaymentSectionProps {
  excedente: number
  selected: OverpaymentHandlingType
  onChange: (v: OverpaymentHandlingType) => void
}

function OverpaymentSection({ excedente, selected, onChange }: OverpaymentSectionProps) {
  const options: Array<{ value: OverpaymentHandlingType; label: string; description: string }> = [
    {
      value: 'cash_change',
      label: 'Devolver troco em dinheiro',
      description: 'O valor é devolvido em mãos. Registrado nas observações.',
    },
    {
      value: 'wallet_credit',
      label: 'Gerar crédito na carteira do cliente',
      description: 'Cria crédito de ' + formatCurrency(excedente) + ' na carteira do cliente.',
    },
    {
      value: 'wallet_voucher',
      label: 'Gerar vale para o cliente',
      description: 'Cria um vale de ' + formatCurrency(excedente) + ' para o cliente.',
    },
  ]

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
          ⚠️ Excedente de {formatCurrency(excedente)}
        </span>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-500">O que fazer com o excedente?</p>
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={[
              'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors',
              selected === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-input bg-card hover:bg-accent',
            ].join(' ')}
          >
            <input
              type="radio"
              name="overpayment"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium text-foreground">{opt.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ──── Modal ───────────────────────────────────────────────────────────────────

interface ReceiveManualModalProps {
  billing: Billing
  open: boolean
  onClose: () => void
}

let lineIdCounter = 1

export function ReceiveManualModal({ billing, open, onClose }: ReceiveManualModalProps) {
  const [lines, setLines] = useState<PaymentLineState[]>([
    { id: lineIdCounter++, method: 'cash', amountStr: '', walletEntryId: '' },
  ])
  const [notes, setNotes] = useState('')
  const [overpaymentHandling, setOverpaymentHandling] =
    useState<OverpaymentHandlingType>('cash_change')

  const receive = useCreateManualReceipt(billing.id)

  const totalPaid = lines.reduce((sum, l) => sum + parseCurrencyInput(l.amountStr), 0)
  const diffCents = billing.amount - totalPaid
  const excedente = totalPaid - billing.amount

  function addLine() {
    setLines((prev) => [
      ...prev,
      { id: lineIdCounter++, method: 'cash', amountStr: '', walletEntryId: '' },
    ])
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function updateLine(id: number, update: Partial<PaymentLineState>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...update } : l)))
  }

  const canConfirm =
    totalPaid >= billing.amount &&
    lines.every((l) => parseCurrencyInput(l.amountStr) > 0) &&
    !receive.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const result = await receive.mutateAsync({
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          paymentMethod: l.method,
          amount: parseCurrencyInput(l.amountStr),
          ...(l.walletEntryId ? { walletEntryId: l.walletEntryId } : {}),
        })),
        ...(excedente > 0 ? { overpaymentHandling: { type: overpaymentHandling } } : {}),
      })

      if (result.walletEntry) {
        toast.success(
          `Pagamento registrado! ${overpaymentHandling === 'wallet_voucher' ? 'Vale' : 'Crédito'} gerado: ${result.walletEntry.code} — ${formatCurrency(result.walletEntry.balance)} adicionado à carteira.`,
          { duration: 6000 },
        )
      } else {
        toast.success('Pagamento registrado com sucesso!')
      }

      onClose()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error(msg ?? 'Erro ao registrar pagamento')
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
          <span className="font-medium">{billing.appointment.service.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor da cobrança</span>
          <span className="text-lg font-bold text-foreground">
            {formatCurrency(billing.amount)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Payment lines */}
        <div>
          <Label className="mb-2 block">Formas de Pagamento</Label>
          <div className="space-y-3">
            {lines.map((line) => (
              <PaymentLineRow
                key={line.id}
                line={line}
                customerId={billing.customer.id}
                canRemove={lines.length > 1}
                onUpdate={(upd) => updateLine(line.id, upd)}
                onRemove={() => removeLine(line.id)}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={addLine}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar forma de pagamento
          </Button>
        </div>

        {/* Total & diff */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total informado</span>
            <span className="font-semibold">{formatCurrency(totalPaid)}</span>
          </div>
          {diffCents > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Faltam</span>
              <span className="font-semibold">{formatCurrency(diffCents)}</span>
            </div>
          )}
          {excedente > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Excedente</span>
              <span className="font-semibold">{formatCurrency(excedente)}</span>
            </div>
          )}
        </div>

        {/* Overpayment section — shown dynamically */}
        {excedente > 0 && (
          <OverpaymentSection
            excedente={excedente}
            selected={overpaymentHandling}
            onChange={setOverpaymentHandling}
          />
        )}

        {/* Notes */}
        <div>
          <Label htmlFor="notes" className="mb-1.5 block">
            Observações
          </Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            className="h-9 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canConfirm}>
            {receive.isPending ? 'Registrando…' : 'Confirmar Recebimento'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
