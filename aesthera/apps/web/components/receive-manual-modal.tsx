'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Minus, Plus, Tag, X } from 'lucide-react'
import { InfoBanner } from '@/components/ui/info-banner'
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
import { useValidatePromotion, useActivePromotionsForService } from '@/lib/hooks/use-promotions'
import {
  useAvailableSessionsForService,
  usePayWithPackage,
  type AvailableSessionEntry,
} from '@/lib/hooks/use-packages'
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

// Frontend-only payment method that maps to a separate endpoint (pay-with-package)
type PaymentLineMethod = ManualReceiptPaymentMethod | 'package_session'

const PAYMENT_METHODS: Array<{ value: PaymentLineMethod; label: string }> = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'card', label: 'Cartão' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'wallet_credit', label: 'Carteira do Cliente' },
  { value: 'package_session', label: 'Sessão de Pacote' },
]

// ──── Payment Line ────────────────────────────────────────────────────────────

interface PaymentLineState {
  id: number
  method: PaymentLineMethod
  amountStr: string
  walletEntryId: string
  walletOriginType?: string | null
  packageSessionId?: string | null
}

interface PaymentLineRowProps {
  line: PaymentLineState
  customerId: string
  billingAmount: number
  billingServiceId?: string | null
  billingSourceType?: string | null
  canRemove: boolean
  availableSessions: AvailableSessionEntry[]
  onUpdate: (updated: Partial<PaymentLineState>) => void
  onRemove: () => void
}

function PaymentLineRow({
  line,
  customerId,
  billingAmount,
  billingServiceId,
  billingSourceType,
  canRemove,
  availableSessions,
  onUpdate,
  onRemove,
}: PaymentLineRowProps) {
  const isWallet = line.method === 'wallet_credit' || line.method === 'wallet_voucher'
  const isPackageSession = line.method === 'package_session'
  const { data: walletData } = useActiveVouchers(customerId, isWallet)
  const allEntries: WalletEntry[] = walletData?.items ?? []

  // SERVICE_PRESALE vouchers: só mostrar quando o serviço bate com o da cobrança
  // E nunca mostrar para cobranças PRESALE (pré-venda não paga pré-venda)
  // RN01 — entradas tipo PACKAGE não aparecem na lista de vales/créditos
  const activeEntries = allEntries.filter((e) => {
    if (e.type === 'PACKAGE') return false
    if (e.originType === 'SERVICE_PRESALE') {
      if (billingSourceType === 'PRESALE') return false  // RN-PV01
      if (!billingServiceId) return false
      return e.serviceId === billingServiceId
    }
    return true
  })
  const isServicePresale = line.walletOriginType === 'SERVICE_PRESALE'
  const isAutoFilled = isServicePresale || isPackageSession

  // Filtrar opções do método: package_session só aparece se houver sessões disponíveis
  const methodOptions = PAYMENT_METHODS.filter((m) => {
    if (m.value === 'package_session') return availableSessions.length > 0 || isPackageSession
    return true
  })

  function handleWalletEntryChange(selectedId: string) {
    const selected = activeEntries.find((e) => e.id === selectedId)
    const originType = selected?.originType ?? null
    // Determinar o método real com base no tipo do item de carteira
    const realMethod: ManualReceiptPaymentMethod = selected?.type === 'CREDIT' ? 'wallet_credit' : 'wallet_voucher'
    if (originType === 'SERVICE_PRESALE') {
      // Pré-venda de serviço: preenche automaticamente com o valor da cobrança
      const autoStr = (billingAmount / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      onUpdate({ walletEntryId: selectedId, walletOriginType: originType, amountStr: autoStr, method: realMethod })
    } else {
      onUpdate({ walletEntryId: selectedId, walletOriginType: originType, method: realMethod })
    }
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <select
            value={isWallet ? 'wallet_credit' : line.method}
            onChange={(e) => {
              const next = e.target.value as PaymentLineMethod
              const isPkg = next === 'package_session'
              const autoStr = isPkg
                ? (billingAmount / 100).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : ''
              const update: Partial<PaymentLineState> = {
                method: next,
                walletEntryId: '',
                walletOriginType: null,
                packageSessionId: null,
              }
              if (isPkg) {
                update.amountStr = autoStr
                // Pré-seleciona a sessão mais antiga (primeiro item já vem ordenado)
                const first = availableSessions[0]
                if (first) update.packageSessionId = first.session.id
              } else {
                update.amountStr = ''
              }
              onUpdate(update)
            }}
            className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          >
            {methodOptions.map((m) => (
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
            disabled={isAutoFilled}
            title={
              isServicePresale
                ? 'Valor definido automaticamente pela pré-venda do serviço'
                : isPackageSession
                  ? 'Valor coberto integralmente pela sessão de pacote'
                  : undefined
            }
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
                onChange={(e) => handleWalletEntryChange(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Selecione um item da carteira…</option>
                {activeEntries.map((e) => {
                  const typeLabel = e.type === 'CREDIT' ? 'Crédito' : e.type === 'CASHBACK' ? 'Cashback' : e.originType === 'SERVICE_PRESALE' ? 'Vale de serviço' : 'Vale'
                  return (
                    <option key={e.id} value={e.id}>
                      {typeLabel} · {e.code} — {formatCurrency(e.balance)}
                    </option>
                  )
                })}
              </select>
            )}
          </div>
        )}

        {isPackageSession && (
          <div>
            {availableSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma sessão de pacote disponível para este serviço.
              </p>
            ) : (
              <select
                value={line.packageSessionId ?? ''}
                onChange={(e) => onUpdate({ packageSessionId: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Selecione uma sessão…</option>
                {availableSessions.map((entry) => (
                  <option key={entry.session.id} value={entry.session.id}>
                    {entry.packageName} · Sessão {entry.sessionNumber} de {entry.totalSessions} ({entry.serviceName})
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
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
          ⚠️ Excedente de {formatCurrency(excedente)}
        </span>
      </div>
      <p className="text-xs text-amber-800 dark:text-amber-200">O que fazer com o excedente?</p>
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
  preSelectedVoucherId?: string
  previousLines?: Array<{ method: string; amount: number }>
}

let lineIdCounter = 1

export function ReceiveManualModal({ billing, open, onClose, preSelectedVoucherId, previousLines }: ReceiveManualModalProps) {
  const customerId = billing.customer.id
  const billingServiceId = billing.appointment?.service?.id ?? billing.service?.id ?? ''
  const billingAppointmentId = billing.appointmentId ?? billing.appointment?.id ?? null

  // Sessões de pacote disponíveis para o serviço desta cobrança
  // Inclui sessões AGENDADO vinculadas ao mesmo agendamento para evitar seleção da sessão errada
  const { data: availableSessionsRaw } = useAvailableSessionsForService(customerId, billingServiceId, billingAppointmentId)
  const availableSessions = availableSessionsRaw ?? []

  const payWithPackage = usePayWithPackage(billing.id)

  const [lines, setLines] = useState<PaymentLineState[]>(() => {
    // Prioridade 1: pré-preenchimento por pagamento anterior (cobrança reaberta)
    if (previousLines?.length) {
      return previousLines.map((pl) => ({
        id: lineIdCounter++,
        method: pl.method as PaymentLineMethod,
        amountStr: (pl.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        walletEntryId: '',
        walletOriginType: null,
      }))
    }
    // Prioridade 2: voucher SERVICE_PRESALE pré-selecionado
    if (preSelectedVoucherId) {
      const amountStr = billing.amount > 0
        ? (billing.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''
      return [{ id: lineIdCounter++, method: 'wallet_voucher', amountStr, walletEntryId: preSelectedVoucherId, walletOriginType: 'SERVICE_PRESALE' }]
    }
    // Prioridade 3: sessão reservada no agendamento (billing.packageSessionId)
    if (billing.packageSessionId && billing.packageSession) {
      const status = billing.packageSession.status
      if (status === 'AGENDADO' || status === 'ABERTO') {
        const autoStr = (billing.amount / 100).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        return [{
          id: lineIdCounter++,
          method: 'package_session',
          amountStr: autoStr,
          walletEntryId: '',
          packageSessionId: billing.packageSessionId,
        }]
      }
    }
    return [{ id: lineIdCounter++, method: 'cash', amountStr: '', walletEntryId: '' }]
  })
  const [notes, setNotes] = useState('')
  const [overpaymentHandling, setOverpaymentHandling] =
    useState<OverpaymentHandlingType>('cash_change')
  const [showPromoPicker, setShowPromoPicker] = useState(false)

  const hasServicePresale = lines.some(
    (l) => l.method === 'wallet_voucher' && l.walletOriginType === 'SERVICE_PRESALE',
  )
  const hasPackageSession = lines.some((l) => l.method === 'package_session')

  // Coupon state
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null)
  const [autoApplied, setAutoApplied] = useState(false)
  const validatePromotion = useValidatePromotion()

  // Item 7: quando pré-venda de serviço OU sessão de pacote está selecionada, limpar promoções aplicadas (RN05)
  useEffect(() => {
    if ((hasServicePresale || hasPackageSession) && appliedCoupon) {
      setAppliedCoupon(null)
      setCouponInput('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasServicePresale, hasPackageSession])

  // Detect if billing already has a promotion locked at booking time
  const hasLockedPromo = !!billing.lockedPromotionCode && !!billing.originalAmount

  // Auto-detect active promotions for the service being billed, filtered by customer limit
  // Skip when billing already has a locked promotion (avoid double-discount)
  const serviceId = billingServiceId
  const { data: servicePromotions } = useActivePromotionsForService(
    serviceId,
    customerId,
    open && !!serviceId && !hasLockedPromo,
  )
  const specificPromotion = servicePromotions?.find(
    (p) => p.applicableServiceIds.includes(serviceId)
  ) ?? null
  const universalPromotion = servicePromotions?.find(
    (p) => p.applicableServiceIds.length === 0
  ) ?? null
  const suggestedPromotion = specificPromotion ?? universalPromotion

  useEffect(() => {
    // Nunca auto-aplicar quando a cobrança já tem promoção travada, pré-venda de serviço ou sessão de pacote selecionada
    if (!suggestedPromotion || appliedCoupon || autoApplied || !open || hasLockedPromo || hasServicePresale || hasPackageSession) return
    setAutoApplied(true)
    validatePromotion.mutateAsync({
      code: suggestedPromotion.code,
      billingAmount: billing.amount,
      serviceIds: serviceId ? [serviceId] : [],
      customerId,
    }).then((r) => {
      setAppliedCoupon({ code: suggestedPromotion.code, discountAmount: r.discountAmount })
      setCouponInput(suggestedPromotion.code)
    }).catch(() => {
      // silently ignore — customer may see manual coupon field
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedPromotion, open])

  const receive = useCreateManualReceipt(billing.id)

  const totalPaid = lines.reduce((sum, l) => sum + parseCurrencyInput(l.amountStr), 0)
  // When billing has a locked promotion, billing.amount already reflects the discount
  const effectiveAmount = hasLockedPromo
    ? billing.amount
    : billing.amount - (appliedCoupon?.discountAmount ?? 0)
  const diffCents = effectiveAmount - totalPaid
  const excedente = totalPaid - effectiveAmount

  async function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    try {
      const result = await validatePromotion.mutateAsync({
        code,
        billingAmount: billing.amount,
        serviceIds: billing.appointment?.service?.id ? [billing.appointment.service.id] : [],
        customerId: billing.customer.id,
      })
      setAppliedCoupon({ code, discountAmount: result.discountAmount })
      toast.success(`Cupom aplicado! Desconto de ${formatCurrency(result.discountAmount)}`)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error(msg ?? 'Cupom inválido')
      setAppliedCoupon(null)
    }
  }

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

  // Prioridade 4: auto-selecionar sessão de pacote quando não há outra prioridade
  // (sessão disponível ABERTO sem reserva prévia)
  useEffect(() => {
    if (!open) return
    if (previousLines?.length || preSelectedVoucherId) return
    if (billing.packageSessionId) return // já tratado na prioridade 3
    // Já tem alguma linha não-cash configurada? não tocar
    const hasUserChoice = lines.some(
      (l) => l.method !== 'cash' || l.amountStr.trim() !== '',
    )
    if (hasUserChoice) return
    if (availableSessions.length === 0) return
    // Pré-seleciona a sessão mais antiga (primeiro item já vem ordenado pela API)
    const first = availableSessions[0]
    const autoStr = (billing.amount / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    setLines([{
      id: lineIdCounter++,
      method: 'package_session',
      amountStr: autoStr,
      walletEntryId: '',
      packageSessionId: first.session.id,
    }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, availableSessions.length])

  const canConfirm =
    !receive.isPending &&
    !payWithPackage.isPending &&
    lines.every((l) => {
      if (l.method === 'package_session') {
        return !!l.packageSessionId
      }
      if (parseCurrencyInput(l.amountStr) <= 0) return false
      if ((l.method === 'wallet_credit' || l.method === 'wallet_voucher') && !l.walletEntryId) return false
      return true
    }) &&
    (hasPackageSession || totalPaid >= effectiveAmount)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Caminho dedicado: sessão de pacote (RN10)
    // RN07 — uma única linha, sem combinação com outros métodos
    if (hasPackageSession) {
      const pkgLine = lines.find((l) => l.method === 'package_session')
      if (!pkgLine?.packageSessionId) {
        toast.error('Selecione uma sessão de pacote')
        return
      }
      try {
        await payWithPackage.mutateAsync(pkgLine.packageSessionId)
        toast.success('Pagamento registrado! Sessão do pacote utilizada.')
        onClose()
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : undefined
        toast.error(msg ?? 'Erro ao registrar pagamento via pacote')
      }
      return
    }

    try {
      const result = await receive.mutateAsync({
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          paymentMethod: l.method as ManualReceiptPaymentMethod,
          amount: parseCurrencyInput(l.amountStr),
          ...(l.walletEntryId ? { walletEntryId: l.walletEntryId } : {}),
        })),
        ...(excedente > 0 ? { overpaymentHandling: { type: overpaymentHandling } } : {}),
        // Não enviar promotionCode quando billing já tem promoção travada (evita duplo desconto)
        ...(appliedCoupon && !hasLockedPromo ? { promotionCode: appliedCoupon.code } : {}),
      })

      if (result.walletEntry) {
        toast.success(
          `Pagamento registrado! ${overpaymentHandling === 'wallet_voucher' ? 'Vale' : 'Crédito'} gerado: ${result.walletEntry.code} — ${formatCurrency(result.walletEntry.balance)} adicionado à carteira.`,
          { duration: 6000 },
        )
      } else {
        toast.success('Pagamento registrado com sucesso!')
      }

      // RN08 — Se havia sessão AGENDADO e o operador pagou por outro método,
      // o backend (manual-receipts.service) já libera a sessão automaticamente.
      // Aqui apenas chamamos release no caso edge de o operador ter trocado a UI
      // sem submeter via package_session, mas a sessão continuar AGENDADO sem ser usada.
      // Esta lógica fica a cargo do backend (RN04 já implementada).

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
          <span className="font-medium">{billing.appointment?.service?.name ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor da cobrança</span>
          <span className="text-lg font-bold text-foreground">
            {formatCurrency(billing.amount)}
          </span>
        </div>
      </div>

      {/* Aviso de voucher pré-selecionado */}
      {preSelectedVoucherId && !previousLines?.length && (
        <InfoBanner
          variant="success"
          title="Vale de pré-venda selecionado"
          description="O vale cobre o valor integral do serviço independente do preço da cobrança. Nenhum desconto de promoção se aplica."
          className="mb-4"
        />
      )}

      {/* Aviso de sessão de pacote selecionada */}
      {hasPackageSession && !previousLines?.length && (
        <InfoBanner
          variant="success"
          title="Sessão de pacote selecionada"
          description="A sessão cobre o valor integral do serviço. Nenhuma promoção se aplica."
          className="mb-4"
        />
      )}

      {/* Aviso de cobrança reaberta com pré-preenchimento */}
      {previousLines?.length ? (
        <InfoBanner
          variant="warning"
          title="Cobrança reaberta — pagamento anterior restaurado"
          description="As formas de pagamento anteriores foram pré-preenchidas. Verifique os valores e confirme o recebimento."
          className="mb-4"
        />
      ) : null}

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
                billingAmount={billing.amount}
                billingServiceId={billing.appointment?.service?.id ?? billing.service?.id ?? null}
                billingSourceType={billing.sourceType ?? null}
                canRemove={lines.length > 1}
                availableSessions={availableSessions}
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

        {/* Promoção travada no agendamento */}
        {hasLockedPromo && (
          <div className="rounded-lg border p-3 space-y-1 text-sm border-green-300 bg-green-100 dark:border-green-800/60 dark:bg-green-950/40">
            <div className="flex justify-between text-green-900 dark:text-green-300">
              <span>Valor original</span>
              <span>{formatCurrency(billing.originalAmount!)}</span>
            </div>
            <div className="flex justify-between font-medium text-green-700 dark:text-green-400">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3 w-3 shrink-0" />
                Promoção{' '}
                <span className="font-mono font-semibold">{billing.lockedPromotionCode}</span>
                <span className="text-xs font-normal text-green-600 dark:text-green-500">(garantida no agendamento)</span>
              </span>
              <span>- {formatCurrency(billing.originalAmount! - billing.amount)}</span>
            </div>
            <div className="border-t border-green-200 dark:border-green-800/50 pt-1 mt-1 flex justify-between font-semibold">
              <span>Valor a pagar</span>
              <span>{formatCurrency(billing.amount)}</span>
            </div>
          </div>
        )}

        {/* Total & diff — ocultado quando paga via sessão de pacote (não é fluxo monetário) */}
        {!hasPackageSession && (
        <div className={`rounded-lg border p-3 space-y-1 text-sm transition-colors ${appliedCoupon ? 'border-green-300 bg-green-100 dark:border-green-800/60 dark:bg-green-950/40' : 'bg-muted/20'}`}>
          {appliedCoupon && (
            <div className="flex justify-between text-green-900 dark:text-green-200">
              <span>Valor original</span>
              <span>{formatCurrency(billing.amount)}</span>
            </div>
          )}
          {appliedCoupon && (
            <div className="flex justify-between font-medium text-green-700 dark:text-green-400">
              <span className="flex items-center gap-1.5"><Tag className="h-3 w-3 shrink-0" /> Desconto cupom <span className="font-mono font-semibold">{appliedCoupon.code}</span></span>
              <span className="font-semibold">- {formatCurrency(appliedCoupon.discountAmount)}</span>
            </div>
          )}
          {appliedCoupon && <div className="border-t border-green-200 dark:border-green-800/50 pt-1 mt-1" />}
          <div className="flex justify-between">
            <span className={appliedCoupon ? 'text-green-900 dark:text-green-200' : 'text-muted-foreground'}>{appliedCoupon ? 'Valor a pagar' : 'Total informado'}</span>
            <span className="font-semibold">{formatCurrency(appliedCoupon ? effectiveAmount : totalPaid)}</span>
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
        )}

        {/* Overpayment section — shown dynamically */}
        {excedente > 0 && !hasPackageSession && (
          <OverpaymentSection
            excedente={excedente}
            selected={overpaymentHandling}
            onChange={setOverpaymentHandling}
          />
        )}

        {/* Coupon / Promotion Code — ocultado quando billing já tem promoção travada, pré-venda ou sessão de pacote */}
        {!hasLockedPromo && !hasServicePresale && !hasPackageSession && (
        <div className="space-y-2">
          {/* Banner promoção aplicada */}
          {appliedCoupon && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-green-300 bg-green-100 px-3 py-2 text-xs dark:border-green-800/60 dark:bg-green-950/40">
              <span className="flex items-center gap-1.5 text-green-800 dark:text-green-300">
                <Check className="h-3.5 w-3.5 shrink-0" />
                Promoção{' '}
                <span className="font-mono font-semibold">{appliedCoupon.code}</span>
                {' — '}
                {formatCurrency(appliedCoupon.discountAmount)} de desconto
              </span>
              <button
                type="button"
                onClick={() => { setAppliedCoupon(null); setCouponInput(''); setShowPromoPicker(false) }}
                className="shrink-0 text-green-700 hover:text-green-900 dark:text-green-400"
                aria-label="Remover promoção"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Picker de promoções disponíveis */}
          {servicePromotions && servicePromotions.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowPromoPicker((v) => !v)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Tag className="h-3 w-3" />
                {appliedCoupon ? 'Selecionar outro desconto' : 'Selecionar desconto disponível'}
                {showPromoPicker ? <span className="ml-0.5">▲</span> : <span className="ml-0.5">▼</span>}
              </button>
              {showPromoPicker && (
                <div className="mt-2 rounded-lg border bg-muted/20 p-2 space-y-1">
                  {servicePromotions.map((promo) => {
                    const isSelected = appliedCoupon?.code === promo.code
                    return (
                      <button
                        key={promo.code}
                        type="button"
                        disabled={validatePromotion.isPending}
                        onClick={() => {
                          if (isSelected) return
                          void validatePromotion.mutateAsync({
                            code: promo.code,
                            billingAmount: billing.amount,
                            serviceIds: serviceId ? [serviceId] : [],
                            customerId,
                          }).then((r) => {
                            setAppliedCoupon({ code: promo.code, discountAmount: r.discountAmount })
                            setCouponInput(promo.code)
                            setShowPromoPicker(false)
                            toast.success(`Promoção aplicada! ${formatCurrency(r.discountAmount)} de desconto`)
                          }).catch(() => toast.error('Não foi possível aplicar esta promoção'))
                        }}
                        className={[
                          'w-full flex items-center justify-between rounded-md px-3 py-2 text-xs transition-colors',
                          isSelected
                            ? 'border border-green-300 bg-green-100 text-green-800 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-300'
                            : 'border border-input bg-card hover:bg-accent text-foreground',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-1.5">
                          {isSelected && <Check className="h-3 w-3 shrink-0" />}
                          <span className="font-mono font-semibold">{promo.code}</span>
                          <span className="text-muted-foreground">
                            {promo.discountType === 'PERCENTAGE'
                              ? `${promo.discountValue}% de desconto`
                              : `${formatCurrency(promo.discountValue)} de desconto`}
                          </span>
                          {promo.applicableServiceIds.length > 0
                            ? <span className="text-[10px] text-muted-foreground">(específica)</span>
                            : <span className="text-[10px] text-muted-foreground">(todos os serviços)</span>
                          }
                        </span>
                        {!isSelected && (
                          <span className="font-medium text-primary">
                            {validatePromotion.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aplicar'}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <Label className="mb-1.5 block">Cupom de desconto</Label>

          <div className="flex gap-2">
            <Input
              value={couponInput}
              onChange={(e) => {
                setCouponInput(e.target.value.toUpperCase())
                if (appliedCoupon) setAppliedCoupon(null)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleApplyCoupon() } }}
              placeholder="CÓDIGO DO CUPOM"
              className="h-9 flex-1 font-mono text-sm uppercase"
              disabled={receive.isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleApplyCoupon()}
              disabled={!couponInput.trim() || validatePromotion.isPending || receive.isPending}
              className="h-9 shrink-0"
            >
              {validatePromotion.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Tag className="mr-1 h-3.5 w-3.5" />
              )}
              Aplicar
            </Button>
          </div>
          {appliedCoupon && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-green-200 bg-green-100 px-3 py-1.5 text-xs text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>Cupom <span className="font-mono font-semibold">{appliedCoupon.code}</span> — {formatCurrency(appliedCoupon.discountAmount)} de desconto</span>
              <button
                type="button"
                onClick={() => { setAppliedCoupon(null); setCouponInput('') }}
                className="ml-auto text-green-700 hover:text-green-900 dark:text-green-400"
                aria-label="Remover cupom"
                title="Remover cupom"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
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
