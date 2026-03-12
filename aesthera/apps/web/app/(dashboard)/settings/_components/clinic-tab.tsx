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
import { useClinic, useUpdateClinic } from '@/lib/hooks/use-settings'

const clinicSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  document: z.string().optional(),
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClinicFormData>({
    resolver: zodResolver(clinicSchema),
  })

  useEffect(() => {
    if (clinic) {
      reset({
        name: clinic.name,
        phone: clinic.phone ?? '',
        document: clinic.document ?? '',
        timezone: clinic.timezone,
        address: clinic.address ?? {},
      })
    }
  }, [clinic, reset])

  async function onSubmit(data: ClinicFormData) {
    try {
      await updateClinic(data)
      toast.success('Dados da clínica atualizados')
    } catch {
      toast.error('Erro ao atualizar dados')
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <Label>Nome da clínica</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input {...register('phone')} placeholder="(11) 91234-5678" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input {...register('document')} placeholder="00.000.000/0001-00" />
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
                <Input {...register('address.zip')} placeholder="00000-000" />
              </div>
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
