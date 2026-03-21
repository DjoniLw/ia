'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type PaymentMethodConfig,
  usePaymentMethodConfig,
  useUpdatePaymentMethodConfig,
} from '@/lib/hooks/use-settings'

const paymentMethodSchema = z
  .object({
    pixEnabled: z.boolean(),
    boletoEnabled: z.boolean(),
    cardEnabled: z.boolean(),
    installmentsEnabled: z.boolean(),
    installmentsMaxMonths: z.coerce
      .number()
      .int()
      .refine((value) => [2, 3, 6, 12].includes(value), 'Selecione um máximo de parcelas válido.'),
    installmentsMinAmountBrl: z.coerce.number().min(1, 'Informe um valor mínimo maior que zero.'),
    duplicataEnabled: z.boolean(),
    duplicataDaysInterval: z.coerce
      .number()
      .int()
      .refine((value) => [15, 30, 60].includes(value), 'Selecione um intervalo válido.'),
    duplicataMaxInstallments: z.coerce
      .number()
      .int()
      .refine((value) => [2, 3, 6].includes(value), 'Selecione um número de parcelas válido.'),
  })
  .superRefine((data, ctx) => {
    if (!data.pixEnabled && !data.boletoEnabled && !data.cardEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pixEnabled'],
        message: 'Ative ao menos uma forma de pagamento.',
      })
    }

    if (data.installmentsEnabled && !data.cardEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installmentsEnabled'],
        message: 'Parcelamento só pode ser ativado quando o cartão estiver habilitado.',
      })
    }

    if (data.duplicataEnabled && !data.pixEnabled && !data.boletoEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['duplicataEnabled'],
        message: 'Duplicata só pode ser ativada quando PIX ou boleto estiverem habilitados.',
      })
    }
  })

type PaymentMethodFormData = z.infer<typeof paymentMethodSchema>

const DEFAULT_VALUES: PaymentMethodFormData = {
  pixEnabled: true,
  boletoEnabled: true,
  cardEnabled: true,
  installmentsEnabled: false,
  installmentsMaxMonths: 12,
  installmentsMinAmountBrl: 100,
  duplicataEnabled: false,
  duplicataDaysInterval: 30,
  duplicataMaxInstallments: 6,
}

function paymentMethodConfigToForm(config: PaymentMethodConfig): PaymentMethodFormData {
  return {
    pixEnabled: config.pixEnabled,
    boletoEnabled: config.boletoEnabled,
    cardEnabled: config.cardEnabled,
    installmentsEnabled: config.installmentsEnabled,
    installmentsMaxMonths: config.installmentsMaxMonths,
    installmentsMinAmountBrl: config.installmentsMinAmount / 100,
    duplicataEnabled: config.duplicataEnabled,
    duplicataDaysInterval: config.duplicataDaysInterval,
    duplicataMaxInstallments: config.duplicataMaxInstallments,
  }
}

function CheckboxCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="border-border bg-card hover:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-primary mt-1 h-4 w-4"
      />
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">{label}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </label>
  )
}

export function PaymentMethodsTab() {
  const { data: config, isLoading } = usePaymentMethodConfig()
  const { mutateAsync: updateConfig, isPending } = useUpdatePaymentMethodConfig()

  const {
    watch,
    register,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentMethodFormData>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const cardEnabled = watch('cardEnabled')
  const installmentsEnabled = watch('installmentsEnabled')
  const duplicataEnabled = watch('duplicataEnabled')

  useEffect(() => {
    if (config) {
      reset(paymentMethodConfigToForm(config))
    }
  }, [config, reset])

  useEffect(() => {
    if (!cardEnabled && installmentsEnabled) {
      setValue('installmentsEnabled', false, { shouldValidate: true })
    }
  }, [cardEnabled, installmentsEnabled, setValue])

  async function onSubmit(data: PaymentMethodFormData) {
    try {
      await updateConfig({
        pixEnabled: data.pixEnabled,
        boletoEnabled: data.boletoEnabled,
        cardEnabled: data.cardEnabled,
        installmentsEnabled: data.cardEnabled ? data.installmentsEnabled : false,
        installmentsMaxMonths: data.installmentsMaxMonths,
        installmentsMinAmount: Math.round(data.installmentsMinAmountBrl * 100),
        duplicataEnabled: data.duplicataEnabled,
        duplicataDaysInterval: data.duplicataDaysInterval,
        duplicataMaxInstallments: data.duplicataMaxInstallments,
      })
      toast.success('Configurações de pagamento salvas.')
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao salvar configurações de pagamento.'
      toast.error(message)
    }
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Carregando...</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formas de pagamento</CardTitle>
        <CardDescription>
          Defina como sua clínica recebe novas cobranças geradas pelo sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-foreground text-sm font-semibold">Meios aceitos</h3>
              <p className="text-muted-foreground text-sm">
                Esses meios aparecem nas novas cobranças geradas para a clínica.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <CheckboxCard
                label="PIX"
                description="Pagamento instantâneo para liquidação rápida."
                checked={watch('pixEnabled')}
                onChange={(checked) =>
                  setValue('pixEnabled', checked, { shouldValidate: true, shouldDirty: true })
                }
              />
              <CheckboxCard
                label="Boleto"
                description="Cobrança bancária com vencimento definido."
                checked={watch('boletoEnabled')}
                onChange={(checked) =>
                  setValue('boletoEnabled', checked, { shouldValidate: true, shouldDirty: true })
                }
              />
              <CheckboxCard
                label="Cartão de crédito"
                description="Pagamento à vista ou parcelado no cartão."
                checked={cardEnabled}
                onChange={(checked) =>
                  setValue('cardEnabled', checked, { shouldValidate: true, shouldDirty: true })
                }
              />
            </div>

            {errors.pixEnabled && (
              <p className="text-destructive text-sm">{errors.pixEnabled.message}</p>
            )}
          </div>

          {cardEnabled && (
            <section className="border-border bg-muted/20 space-y-4 rounded-xl border p-4">
              <div className="space-y-1">
                <h3 className="text-foreground text-sm font-semibold">Parcelamento</h3>
                <p className="text-muted-foreground text-sm">
                  Configure o parcelamento disponível quando o cliente pagar com cartão.
                </p>
              </div>

              <label className="text-foreground flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  {...register('installmentsEnabled')}
                  className="accent-primary h-4 w-4"
                />
                Habilitar parcelamento
              </label>

              {errors.installmentsEnabled && (
                <p className="text-destructive text-sm">{errors.installmentsEnabled.message}</p>
              )}

              {installmentsEnabled && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="installmentsMaxMonths">Máximo de parcelas</Label>
                    <select
                      id="installmentsMaxMonths"
                      {...register('installmentsMaxMonths')}
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="2">2x</option>
                      <option value="3">3x</option>
                      <option value="6">6x</option>
                      <option value="12">12x</option>
                    </select>
                    {errors.installmentsMaxMonths && (
                      <p className="text-destructive text-sm">
                        {errors.installmentsMaxMonths.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="installmentsMinAmountBrl">
                      Valor mínimo para parcelar (R$)
                    </Label>
                    <Input
                      id="installmentsMinAmountBrl"
                      type="number"
                      min="1"
                      step="0.01"
                      {...register('installmentsMinAmountBrl')}
                    />
                    {errors.installmentsMinAmountBrl && (
                      <p className="text-destructive text-sm">
                        {errors.installmentsMinAmountBrl.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="border-border bg-muted/20 space-y-4 rounded-xl border p-4">
            <div className="space-y-1">
              <h3 className="text-foreground text-sm font-semibold">Duplicata</h3>
              <p className="text-muted-foreground text-sm">
                Nesta fase, a duplicata salva apenas as regras da cobrança parcelada da clínica.
              </p>
            </div>

            <label className="text-foreground flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                {...register('duplicataEnabled')}
                className="accent-primary h-4 w-4"
              />
              Habilitar duplicata
            </label>

            {errors.duplicataEnabled && (
              <p className="text-destructive text-sm">{errors.duplicataEnabled.message}</p>
            )}

            {duplicataEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="duplicataMaxInstallments">Máximo de parcelas</Label>
                  <select
                    id="duplicataMaxInstallments"
                    {...register('duplicataMaxInstallments')}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="2">2 parcelas</option>
                    <option value="3">3 parcelas</option>
                    <option value="6">6 parcelas</option>
                  </select>
                  {errors.duplicataMaxInstallments && (
                    <p className="text-destructive text-sm">
                      {errors.duplicataMaxInstallments.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duplicataDaysInterval">Intervalo entre vencimentos</Label>
                  <select
                    id="duplicataDaysInterval"
                    {...register('duplicataDaysInterval')}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="15">15 dias</option>
                    <option value="30">30 dias</option>
                    <option value="60">60 dias</option>
                  </select>
                  {errors.duplicataDaysInterval && (
                    <p className="text-destructive text-sm">
                      {errors.duplicataDaysInterval.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar configurações'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
