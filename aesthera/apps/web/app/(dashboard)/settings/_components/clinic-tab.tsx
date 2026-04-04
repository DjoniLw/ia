'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MaskedInputCnpj } from '@/components/ui/masked-input-cnpj'
import { MaskedInputPhone } from '@/components/ui/masked-input-phone'
import { MaskedInputCep } from '@/components/ui/masked-input-cep'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Switch } from '@/components/ui/switch'
import { useClinic, useUpdateClinic } from '@/lib/hooks/use-settings'
import { useCepLookup } from '@/lib/hooks/use-cep-lookup'

const clinicSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  document: z.string().refine((value) => {
    const digits = value.replace(/\D/g, '')
    return digits.length === 0 || digits.length === 14
  }, 'Informe um CNPJ com 14 dígitos ou deixe em branco.'),
  timezone: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional(),
  chargeVoucherDifference: z.boolean().optional(),
})

type ClinicFormData = z.infer<typeof clinicSchema>

export function ClinicTab() {
  const { data: clinic, isLoading } = useClinic()
  const { mutateAsync: updateClinic, isPending } = useUpdateClinic()
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false)
  const { lookup: lookupCep, isLoading: loadingCep, notFound: cepNotFound, reset: resetCep } = useCepLookup()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ClinicFormData>({ resolver: zodResolver(clinicSchema) })

  const document = watch('document') ?? ''

  useEffect(() => {
    if (clinic) {
      reset({
        name: clinic.name,
        phone: (clinic.phone ?? '').replace(/\D/g, ''),
        document: (clinic.document ?? '').replace(/\D/g, ''),
        timezone: clinic.timezone,
        address: {
          ...clinic.address,
          zip: (clinic.address?.zip ?? '').replace(/\D/g, ''),
        },
        chargeVoucherDifference: clinic.chargeVoucherDifference ?? false,
      })
    }
  }, [clinic, reset])

  async function handleLookupCnpj() {
    const digits = document.replace(/\D/g, '')
    if (digits.length !== 14) return

    setLookingUpCnpj(true)
    try {
      const response = await api.get<{
        razaoSocial?: string
        nomeFantasia?: string
        telefone?: string
        cep?: string
        logradouro?: string
        municipio?: string
        uf?: string
      }>(`/clinics/lookup-cnpj?cnpj=${digits}`)

      const data = response.data
      const clinicName = data.nomeFantasia || data.razaoSocial || ''
      if (clinicName) setValue('name', clinicName, { shouldValidate: true })
      if (data.telefone) setValue('phone', data.telefone.replace(/\D/g, ''), { shouldValidate: false })
      if (data.logradouro) setValue('address.street', data.logradouro, { shouldValidate: false })
      if (data.municipio) setValue('address.city', data.municipio, { shouldValidate: false })
      if (data.uf) setValue('address.state', data.uf, { shouldValidate: false })
      if (data.cep) setValue('address.zip', data.cep.replace(/\D/g, ''), { shouldValidate: false })

      if (clinicName || data.telefone || data.logradouro) {
        toast.success('Dados da empresa preenchidos com base no CNPJ. Revise antes de salvar.')
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Não foi possível consultar o CNPJ agora.'
      toast.error(message)
    } finally {
      setLookingUpCnpj(false)
    }
  }

  async function onSubmit(data: ClinicFormData) {
    try {
      await updateClinic(data)
      toast.success('Dados da clínica atualizados')
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao atualizar dados'
      toast.error(message)
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da clínica</CardTitle>
        <CardDescription>Informações básicas exibidas para seus clientes</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
          <div className="space-y-2">
            <Label>Nome da clínica</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <MaskedInputPhone
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Controller
                control={control}
                name="document"
                render={({ field }) => (
                  <MaskedInputCnpj
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={() => {
                      field.onBlur()
                      void handleLookupCnpj()
                    }}
                    name={field.name}
                    disabled={lookingUpCnpj}
                  />
                )}
              />
              {lookingUpCnpj && <p className="text-xs text-muted-foreground">Consultando Receita Federal...</p>}
              {errors.document && <p className="text-sm text-destructive">{errors.document.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fuso horário</Label>
            <Input {...register('timezone')} placeholder="America/Sao_Paulo" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Endereço</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CEP</Label>
                <Controller
                  control={control}
                  name="address.zip"
                  render={({ field }) => (
                    <div className="relative">
                      <MaskedInputCep
                        ref={field.ref}
                        value={field.value}
                        disabled={loadingCep}
                        onChange={(v) => {
                          field.onChange(v)
                          if (v.length < 8) { resetCep(); return }
                          void lookupCep(v).then((addr) => {
                            if (!addr) return
                            setValue('address.street', addr.logradouro, { shouldDirty: true })
                            setValue('address.neighborhood', addr.bairro, { shouldDirty: true })
                            setValue('address.city', addr.localidade, { shouldDirty: true })
                            setValue('address.state', addr.uf, { shouldDirty: true })
                          })
                        }}
                        onBlur={(e) => {
                          field.onBlur()
                          const digits = (field.value ?? '').replace(/\D/g, '')
                          if (digits.length !== 8) return
                          void lookupCep(digits).then((addr) => {
                            if (!addr) return
                            setValue('address.street', addr.logradouro, { shouldDirty: true })
                            setValue('address.neighborhood', addr.bairro, { shouldDirty: true })
                            setValue('address.city', addr.localidade, { shouldDirty: true })
                            setValue('address.state', addr.uf, { shouldDirty: true })
                          })
                        }}
                        name={field.name}
                      />
                      {loadingCep && (
                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}
                />
                {cepNotFound && <p className="text-xs text-destructive">CEP não encontrado</p>}
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Rua / Logradouro</Label>
                <Input {...register('address.street')} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input {...register('address.neighborhood')} placeholder="Centro" />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input {...register('address.city')} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input {...register('address.state')} placeholder="SP" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium">Cobrança de saldo de pré-venda</p>
            <p className="text-xs text-muted-foreground">
              Quando ativado, ao usar um voucher de pré-venda cuja cobrança foi menor que o valor do serviço, uma cobrança complementar será gerada automaticamente pela diferença.
            </p>
            <Controller
              control={control}
              name="chargeVoucherDifference"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Switch
                    id="chargeVoucherDifference"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                  <Label htmlFor="chargeVoucherDifference" className="text-sm">
                    Cobrar diferença de pré-venda
                  </Label>
                </div>
              )}
            />
          </div>

          <Button type="submit" disabled={isPending || lookingUpCnpj}>
            {isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
