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
import { api } from '@/lib/api'
import { useClinic, useUpdateClinic } from '@/lib/hooks/use-settings'

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
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional(),
})

type ClinicFormData = z.infer<typeof clinicSchema>

export function ClinicTab() {
  const { data: clinic, isLoading } = useClinic()
  const { mutateAsync: updateClinic, isPending } = useUpdateClinic()
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false)

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
              <div className="col-span-2 space-y-2">
                <Label>Rua / Logradouro</Label>
                <Input {...register('address.street')} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input {...register('address.city')} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input {...register('address.state')} placeholder="SP" />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Controller
                  control={control}
                  name="address.zip"
                  render={({ field }) => (
                    <MaskedInputCep
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isPending || lookingUpCnpj}>
            {isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
