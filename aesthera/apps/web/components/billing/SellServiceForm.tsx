'use client'

/**
 * Formulário de criação de cobrança de serviço.
 * Suporta dois modos:
 * - PRESALE (padrão): pré-venda vinculada a um serviço; ao ser paga gera WalletEntry SERVICE_PRESALE.
 * - MANUAL: cobrança avulsa sem vínculo obrigatório a serviço ou agendamento.
 */

import { useState } from 'react'
import { Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ComboboxSearch, type ComboboxItem } from '@/components/ui/combobox-search'
import { useServices, useCustomers } from '@/lib/hooks/use-resources'
import { useCreateBilling } from '@/lib/hooks/use-appointments'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function parseCurrencyInput(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (!normalized) return 0
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

// ──── Props ────────────────────────────────────────────────────────────────────

interface SellServiceFormProps {
  mode?: 'PRESALE' | 'MANUAL'
  defaultCustomerId?: string
  defaultCustomerName?: string
  onSuccess?: () => void
  onCancel?: () => void
}

// ──── Component ────────────────────────────────────────────────────────────────

export function SellServiceForm({
  mode = 'PRESALE',
  defaultCustomerId,
  defaultCustomerName,
  onSuccess,
  onCancel,
}: SellServiceFormProps) {
  const isManual = mode === 'MANUAL'
  const [customerSearch, setCustomerSearch] = useState(defaultCustomerName ?? '')
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(
    defaultCustomerId && defaultCustomerName
      ? { id: defaultCustomerId, name: defaultCustomerName }
      : null,
  )
  const [selectedService, setSelectedService] = useState<{ id: string; name: string; price: number } | null>(null)
  const [amountStr, setAmountStr] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')

  const { data: customersData } = useCustomers(
    customerSearch.trim().length >= 1 ? { name: customerSearch.trim(), limit: '20' } : undefined,
  )
  const { data: servicesData } = useServices(
    serviceSearch.trim().length >= 1
      ? { name: serviceSearch.trim(), active: 'true', limit: '30' }
      : { active: 'true', limit: '30' },
  )

  const createBilling = useCreateBilling()

  const customerItems: ComboboxItem[] =
    customersData?.items.map((c) => ({ value: c.id, label: c.name })) ?? []

  const serviceItems: ComboboxItem[] =
    servicesData?.items.map((s) => ({ value: s.id, label: `${s.name} · ${formatCurrency(s.price)}` })) ?? []

  function handleServiceSelect(item: ComboboxItem | null) {
    if (!item) {
      setSelectedService(null)
      setAmountStr('')
      return
    }
    const svc = servicesData?.items.find((s) => s.id === item.value)
    if (svc) {
      setSelectedService({ id: svc.id, name: svc.name, price: svc.price })
      // Pré-preencher com o preço de catálogo
      const priceFormatted = (svc.price / 100).toFixed(2).replace('.', ',')
      setAmountStr(priceFormatted)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCustomer) {
      toast.error('Selecione um cliente')
      return
    }
    if (!isManual && !selectedService) {
      toast.error('Selecione um serviço')
      return
    }

    const amount = parseCurrencyInput(amountStr)
    if (amount <= 0) {
      toast.error('Informe um valor válido')
      return
    }

    try {
      await createBilling.mutateAsync({
        customerId: selectedCustomer.id,
        sourceType: mode,
        amount,
        serviceId: selectedService?.id,
        notes: notes.trim() || undefined,
        dueDate: dueDate || undefined,
      })
      if (isManual) {
        toast.success('Cobrança registrada com sucesso!')
      } else {
        toast.success('Pré-venda registrada com sucesso! Cobrança gerada.')
      }
      onSuccess?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : isManual ? 'Erro ao registrar cobrança' : 'Erro ao registrar pré-venda'
      toast.error(message)
    }
  }

  const catalogPrice = selectedService?.price
  const enteredAmount = parseCurrencyInput(amountStr)
  const showPriceDiff =
    catalogPrice !== undefined && enteredAmount > 0 && enteredAmount !== catalogPrice

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Cliente */}
      <div className="space-y-1.5">
        <Label htmlFor="customer">Cliente</Label>
        {defaultCustomerId ? (
          <Input value={defaultCustomerName ?? ''} disabled />
        ) : (
          <ComboboxSearch
            items={customerItems}
            value={selectedCustomer ? { value: selectedCustomer.id, label: selectedCustomer.name } : null}
            onChange={(item) => {
              if (!item) { setSelectedCustomer(null); return }
              const c = customersData?.items.find((x) => x.id === item.value)
              if (c) setSelectedCustomer({ id: c.id, name: c.name })
            }}
            onSearch={setCustomerSearch}
            placeholder="Buscar cliente…"
          />
        )}
      </div>

      {/* Serviço */}
      <div className="space-y-1.5">
        <Label htmlFor="service">{isManual ? 'Serviço (opcional)' : 'Serviço'}</Label>
        <ComboboxSearch
          items={serviceItems}
          value={selectedService ? { value: selectedService.id, label: `${selectedService.name} · ${formatCurrency(selectedService.price)}` } : null}
          onChange={handleServiceSelect}
          onSearch={setServiceSearch}
          placeholder="Buscar serviço…"
        />
        {catalogPrice !== undefined && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Tag className="h-3 w-3" />
            Preço de catálogo: {formatCurrency(catalogPrice)}
          </p>
        )}
      </div>

      {/* Valor */}
      <div className="space-y-1.5">
        <Label htmlFor="amount">Valor cobrado (R$)</Label>
        <Input
          id="amount"
          placeholder="0,00"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
        />
        {showPriceDiff && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Valor diferente do preço de catálogo ({formatCurrency(catalogPrice!)}).
          </p>
        )}
      </div>

      {/* Vencimento */}
      <div className="space-y-1.5">
        <Label htmlFor="dueDate">Vencimento (opcional)</Label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações (opcional)</Label>
        <Input
          id="notes"
          placeholder={isManual ? 'Ex: manutenção, revisão…' : 'Ex: pacote especial, promoção…'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={createBilling.isPending} className="flex-1">
          {createBilling.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isManual ? 'Registrar Cobrança' : 'Registrar Pré-venda'}
        </Button>
      </div>
    </form>
  )
}
