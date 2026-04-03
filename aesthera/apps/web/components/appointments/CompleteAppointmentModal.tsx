'use client'

import { AlertTriangle, CheckCircle, Loader2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import type { Appointment } from '@/lib/hooks/use-appointments'
import type { ServiceVoucher } from '@/lib/hooks/use-wallet'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ──── Props ────────────────────────────────────────────────────────────────────

interface CompleteAppointmentModalProps {
  open: boolean
  onClose: () => void
  appointment: Appointment | null
  serviceVouchers: ServiceVoucher[]
  isLoadingVouchers: boolean
  onGenerateBilling: () => void
  onUseVoucher: (voucher: ServiceVoucher) => void
  onSkip: () => void
  isGenerating?: boolean
}

// ──── Component ────────────────────────────────────────────────────────────────

export function CompleteAppointmentModal({
  open,
  onClose,
  appointment,
  serviceVouchers,
  isLoadingVouchers,
  onGenerateBilling,
  onUseVoucher,
  onSkip,
  isGenerating,
}: CompleteAppointmentModalProps) {
  if (!appointment) return null

  const hasVouchers = serviceVouchers.length > 0
  const serviceName = appointment.service?.name ?? 'Serviço'

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
        <CheckCircle className="h-5 w-5 text-green-500" />
        Atendimento concluído
      </DialogTitle>

      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{appointment.customer?.name}</span>
        {' · '}
        {serviceName}
      </p>

      {/* Estado: Carregando vouchers */}
      {isLoadingVouchers && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando vouchers disponíveis…
        </div>
      )}

      {/* Estado: Vouchers disponíveis */}
      {!isLoadingVouchers && hasVouchers && (
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30 p-3">
            <p className="text-sm font-medium text-teal-800 dark:text-teal-200 flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" />
              Vale(s) de pré-venda disponível
            </p>
            <p className="text-xs text-teal-700 dark:text-teal-300 mt-0.5">
              Este cliente possui vale(s) pré-pago(s) para {serviceName}. Deseja utilizá-lo para quitação?
            </p>
          </div>

          <div className="space-y-2">
            {serviceVouchers.map((voucher) => (
              <button
                key={voucher.id}
                type="button"
                onClick={() => onUseVoucher(voucher)}
                className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      Vale {voucher.code}
                    </span>
                    {voucher.service && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {voucher.service.name}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                    {formatCurrency(voucher.balance)}
                  </span>
                </div>
                {voucher.expirationDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Válido até {formatDate(voucher.expirationDate)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Estado: Sem vouchers */}
      {!isLoadingVouchers && !hasVouchers && (
        <div className="mt-4 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            Nenhum vale de pré-venda encontrado para este serviço.
          </p>
        </div>
      )}

      {/* Ações */}
      {!isLoadingVouchers && (
        <div className="mt-5 flex flex-col gap-2">
          <Button
            onClick={onGenerateBilling}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            {hasVouchers ? 'Gerar cobrança avulsa' : 'Gerar cobrança'}
          </Button>

          {hasVouchers && (
            <p className="text-center text-xs text-muted-foreground">
              ou use um vale acima para quitar automaticamente
            </p>
          )}

          <Button
            variant="outline"
            onClick={onSkip}
            className="w-full"
          >
            Pular cobrança agora
          </Button>
        </div>
      )}
    </Dialog>
  )
}
