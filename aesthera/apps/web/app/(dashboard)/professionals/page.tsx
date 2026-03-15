'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type Professional,
  type Service,
  useAssignServices,
  useCreateProfessional,
  useDeleteProfessional,
  useProfessionals,
  useServices,
  useUpdateProfessional,
} from '@/lib/hooks/use-resources'

// ──── Schemas ──────────────────────────────────────────────────────────────────

const professionalSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  speciality: z.string().optional(),
})
type ProfessionalFormData = z.infer<typeof professionalSchema>

// ──── ProfessionalForm ─────────────────────────────────────────────────────────

function ProfessionalForm({
  defaultValues,
  onSave,
  isPending,
  onDirtyChange,
}: {
  defaultValues?: Partial<ProfessionalFormData>
  onSave: (data: ProfessionalFormData) => Promise<void>
  isPending: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfessionalFormData>({
    resolver: zodResolver(professionalSchema),
    defaultValues,
  })

  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty, onDirtyChange])

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input {...register('name')} placeholder="Ana Lima" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>E-mail</Label>
        <Input {...register('email')} type="email" placeholder="ana@clinica.com" />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input {...register('phone')} placeholder="+55 11 99999-9999" />
      </div>

      <div className="space-y-2">
        <Label>Especialidade</Label>
        <Input {...register('speciality')} placeholder="Esteticista, Dermatologista…" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

// ──── AssignServicesDialog ─────────────────────────────────────────────────────

function AssignServicesDialog({
  professional,
  onClose,
}: {
  professional: Professional
  onClose: () => void
}) {
  const { data: servicesData } = useServices()
  const assignServices = useAssignServices(professional.id)

  const currentIds = new Set((professional.services ?? []).map((ps) => ps.service.id))
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds))
  const [allServices, setAllServices] = useState(professional.allServices ?? false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    try {
      await assignServices.mutateAsync({ serviceIds: [...selected], allServices })
      toast.success('Serviços atualizados')
      onClose()
    } catch {
      toast.error('Erro ao atualizar serviços')
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-sm">
      <DialogTitle>Serviços de {professional.name}</DialogTitle>
      {/* All-services toggle */}
      <div className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/50 px-3 py-2.5">
        <input
          type="checkbox"
          id="all-services"
          checked={allServices}
          onChange={(e) => setAllServices(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <label htmlFor="all-services" className="cursor-pointer text-sm font-medium">
          Todos os serviços (incluindo futuros)
        </label>
      </div>
      <div className={`mt-3 space-y-2 max-h-64 overflow-y-auto ${allServices ? 'opacity-40 pointer-events-none' : ''}`}>
        {servicesData?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
        )}
        {servicesData?.items.map((svc: Service) => (
          <label key={svc.id} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(svc.id)}
              onChange={() => toggle(svc.id)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm">
              {svc.name}
              {svc.category ? ` — ${svc.category}` : ''}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={assignServices.isPending}>
          {assignServices.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Dialog>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

export default function ProfessionalsPage() {
  const { data, isLoading } = useProfessionals()
  const createProfessional = useCreateProfessional()
  const deleteProfessional = useDeleteProfessional()

  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Professional | null>(null)
  const [assigningTo, setAssigningTo] = useState<Professional | null>(null)

  const updateProfessional = useUpdateProfessional(editing?.id ?? '')

  async function handleCreate(formData: ProfessionalFormData) {
    try {
      await createProfessional.mutateAsync({
        ...formData,
        phone: formData.phone ?? null,
        speciality: formData.speciality ?? null,
      })
      toast.success('Profissional criado')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar profissional')
    }
  }

  async function handleUpdate(formData: ProfessionalFormData) {
    try {
      await updateProfessional.mutateAsync({
        ...formData,
        phone: formData.phone ?? null,
        speciality: formData.speciality ?? null,
      })
      toast.success('Profissional atualizado')
      setEditing(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar profissional')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este profissional?')) return
    try {
      await deleteProfessional.mutateAsync(id)
      toast.success('Profissional removido')
    } catch {
      toast.error('Erro ao remover profissional')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Profissionais</h2>
          <p className="text-sm text-muted-foreground">Gerencie a equipe da clínica</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Novo Profissional</Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-3 pl-4 pr-2 text-left font-medium">Nome</th>
              <th className="px-2 py-3 text-left font-medium">Especialidade</th>
              <th className="px-2 py-3 text-left font-medium">E-mail</th>
              <th className="px-2 py-3 text-left font-medium">Status</th>
              <th className="px-2 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum profissional cadastrado.
                </td>
              </tr>
            )}
            {data?.items.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 pl-4 pr-2 font-medium">{p.name}</td>
                <td className="px-2 py-3 text-muted-foreground">{p.speciality ?? '—'}</td>
                <td className="px-2 py-3 text-muted-foreground">{p.email}</td>
                <td className="px-2 py-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      p.active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-muted text-muted-foreground',
                    ].join(' ')}
                  >
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAssigningTo(p)}>
                      Serviços
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(p.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)} isDirty={formDirty}>
          <DialogTitle>Novo Profissional</DialogTitle>
          <div className="mt-4">
            <ProfessionalForm onSave={handleCreate} isPending={createProfessional.isPending} onDirtyChange={setFormDirty} />
          </div>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} isDirty={formDirty}>
          <DialogTitle>Editar Profissional</DialogTitle>
          <div className="mt-4">
            <ProfessionalForm
              defaultValues={{
                ...editing,
                phone: editing.phone ?? undefined,
                speciality: editing.speciality ?? undefined,
              }}
              onSave={handleUpdate}
              isPending={updateProfessional.isPending}
              onDirtyChange={setFormDirty}
            />
          </div>
        </Dialog>
      )}

      {/* Assign services dialog */}
      {assigningTo && (
        <AssignServicesDialog
          professional={assigningTo}
          onClose={() => setAssigningTo(null)}
        />
      )}
    </div>
  )
}
