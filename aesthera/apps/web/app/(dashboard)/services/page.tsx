'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type Service,
  useCreateService,
  useDeleteService,
  useServices,
  useUpdateService,
} from '@/lib/hooks/use-resources'

function parseBRL(value: string): number {
  // Accept "150,00" or "150.00" or "150" → returns cents
  const normalized = value.replace(/\./g, '').replace(',', '.')
  return Math.round(parseFloat(normalized) * 100)
}

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive().refine((v) => v % 15 === 0, 'Múltiplo de 15'),
  priceDisplay: z.string().min(1, 'Informe o preço').refine((v) => {
    const n = parseBRL(v)
    return !isNaN(n) && n >= 0
  }, 'Preço inválido'),
})
type ServiceFormData = z.infer<typeof serviceSchema>

function ServiceForm({
  defaultValues,
  onSave,
  isPending,
}: {
  defaultValues?: Partial<ServiceFormData & { price: number }>
  onSave: (data: ServiceFormData) => Promise<void>
  isPending: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          // Convert cents to display string (e.g. 15000 → "150,00")
          priceDisplay: defaultValues.price != null
            ? (defaultValues.price / 100).toFixed(2).replace('.', ',')
            : '',
        }
      : undefined,
  })

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input {...register('name')} placeholder="Botox" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input {...register('description')} placeholder="Opcional" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input {...register('category')} placeholder="facial, corporal..." />
        </div>
        <div className="space-y-2">
          <Label>Duração (min)</Label>
          <Input type="number" {...register('durationMinutes')} placeholder="60" />
          {errors.durationMinutes && (
            <p className="text-xs text-destructive">{errors.durationMinutes.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Preço (R$)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
          <Input
            {...register('priceDisplay')}
            placeholder="150,00"
            className="pl-9"
            inputMode="decimal"
          />
        </div>
        {errors.priceDisplay && <p className="text-xs text-destructive">{errors.priceDisplay.message}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

function priceDisplay(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ServicesPage() {
  const { data, isLoading } = useServices()
  const { mutateAsync: create, isPending: creating } = useCreateService()
  const { mutateAsync: del } = useDeleteService()

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const { mutateAsync: update, isPending: updating } = useUpdateService(editing?.id ?? '')

  async function handleCreate(data: ServiceFormData) {
    try {
      await create({
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        durationMinutes: data.durationMinutes,
        price: parseBRL(data.priceDisplay),
      })
      toast.success('Serviço criado')
      setShowCreate(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar serviço')
    }
  }

  async function handleUpdate(data: ServiceFormData) {
    try {
      await update({
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        durationMinutes: data.durationMinutes,
        price: parseBRL(data.priceDisplay),
      })
      toast.success('Serviço atualizado')
      setEditing(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar serviço')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return
    try {
      await del(id)
      toast.success('Serviço excluído')
    } catch {
      toast.error('Erro ao excluir serviço')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Serviços</h2>
        <Button onClick={() => setShowCreate(true)}>+ Novo serviço</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Categoria</th>
                <th className="text-right px-4 py-3 font-medium">Duração</th>
                <th className="text-right px-4 py-3 font-medium">Preço</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{s.durationMinutes}min</td>
                  <td className="px-4 py-3 text-right">{priceDisplay(s.price)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>Editar</Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id, s.name)}>Excluir</Button>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum serviço cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogTitle>Novo serviço</DialogTitle>
        <ServiceForm onSave={handleCreate} isPending={creating} />
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)}>
        <DialogTitle>Editar serviço</DialogTitle>
        {editing && (
          <ServiceForm
            defaultValues={{
              ...editing,
              description: editing.description ?? undefined,
              category: editing.category ?? undefined,
            }}
            onSave={handleUpdate}
            isPending={updating}
          />
        )}
      </Dialog>
    </div>
  )
}
