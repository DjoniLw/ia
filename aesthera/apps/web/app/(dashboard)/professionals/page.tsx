'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Info, Loader2, Pencil, Search, Trash2, UserRound, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MaskedInputCep } from '@/components/ui/masked-input-cep'
import { MaskedInputPhone } from '@/components/ui/masked-input-phone'
import { useCepLookup } from '@/lib/hooks/use-cep-lookup'
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

type StatusFilter = 'all' | 'active' | 'inactive'
const STATUS_LABELS: Record<StatusFilter, string> = { all: 'Todos', active: 'Ativos', inactive: 'Inativos' }

// ──── Schemas ──────────────────────────────────────────────────────────────────

const professionalSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  speciality: z.string().optional(),
  addr_street: z.string().optional(),
  addr_number: z.string().optional(),
  addr_complement: z.string().optional(),
  addr_neighborhood: z.string().optional(),
  addr_city: z.string().optional(),
  addr_state: z.string().optional(),
  addr_zip: z.string().optional(),
})
type ProfessionalFormData = z.infer<typeof professionalSchema>

function toProfessionalPayload(formData: ProfessionalFormData) {
  const address = {
    street: formData.addr_street || undefined,
    number: formData.addr_number || undefined,
    complement: formData.addr_complement || undefined,
    neighborhood: formData.addr_neighborhood || undefined,
    city: formData.addr_city || undefined,
    state: formData.addr_state || undefined,
    zip: formData.addr_zip || undefined,
  }

  const hasAddress = Object.values(address).some(Boolean)

  return {
    name: formData.name,
    email: formData.email,
    phone: formData.phone ?? null,
    speciality: formData.speciality ?? null,
    address: hasAddress ? address : undefined,
  }
}

function fromProfessional(professional: Professional): Partial<ProfessionalFormData> {
  const address = professional.address ?? {}

  return {
    name: professional.name,
    email: professional.email,
    phone: (professional.phone ?? '').replace(/\D/g, '') || undefined,
    speciality: professional.speciality ?? undefined,
    addr_street: address.street ?? '',
    addr_number: address.number ?? '',
    addr_complement: address.complement ?? '',
    addr_neighborhood: address.neighborhood ?? '',
    addr_city: address.city ?? '',
    addr_state: address.state ?? '',
    addr_zip: (address.zip ?? '').replace(/\D/g, ''),
  }
}

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
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProfessionalFormData>({
    resolver: zodResolver(professionalSchema),
    defaultValues,
  })

  const { lookup: lookupCep, isLoading: loadingCep, notFound: cepNotFound, reset: resetCep } = useCepLookup()

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
        <Label>Especialidade</Label>
        <Input {...register('speciality')} placeholder="Esteticista, Dermatologista…" />
      </div>

      <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Endereço</p>
          <p className="text-xs text-muted-foreground">O CEP pode preencher os campos automaticamente.</p>
        </div>

        <div className="space-y-2 max-w-xs">
          <Label>CEP</Label>
          <Controller
            control={control}
            name="addr_zip"
            render={({ field }) => (
              <div className="relative">
                <MaskedInputCep
                  ref={field.ref}
                  value={field.value}
                  disabled={loadingCep}
                  onChange={(value) => {
                    field.onChange(value)
                    if (value.length < 8) {
                      resetCep()
                      return
                    }

                    void lookupCep(value).then((address) => {
                      if (!address) return
                      setValue('addr_street', address.logradouro, { shouldDirty: true })
                      setValue('addr_neighborhood', address.bairro, { shouldDirty: true })
                      setValue('addr_city', address.localidade, { shouldDirty: true })
                      setValue('addr_state', address.uf, { shouldDirty: true })
                    })
                  }}
                  onBlur={() => {
                    field.onBlur()
                    const digits = (field.value ?? '').replace(/\D/g, '')
                    if (digits.length !== 8) return

                    void lookupCep(digits).then((address) => {
                      if (!address) return
                      setValue('addr_street', address.logradouro, { shouldDirty: true })
                      setValue('addr_neighborhood', address.bairro, { shouldDirty: true })
                      setValue('addr_city', address.localidade, { shouldDirty: true })
                      setValue('addr_state', address.uf, { shouldDirty: true })
                    })
                  }}
                  name={field.name}
                />
                {loadingCep && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            )}
          />
          {cepNotFound && <p className="text-xs text-destructive">CEP não encontrado</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-2">
            <Label>Logradouro</Label>
            <Input {...register('addr_street')} placeholder="Rua das Flores" />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input {...register('addr_number')} placeholder="123" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input {...register('addr_complement')} placeholder="Sala 2" />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input {...register('addr_neighborhood')} placeholder="Centro" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-2">
            <Label>Cidade</Label>
            <Input {...register('addr_city')} placeholder="São Paulo" />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('addr_state')}>
              <option value="">UF</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => <option key={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
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

// ──── Delete Confirm ──────────────────────────────────────────────────────────

function DeleteProfessionalConfirm({
  professional,
  onConfirm,
  onCancel,
}: {
  professional: Professional
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tem certeza que deseja remover o profissional <strong>{professional.name}</strong>? Esta ação não pode ser desfeita.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button variant="destructive" onClick={onConfirm}>Remover</Button>
      </div>
    </div>
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
  const [deleting, setDeleting] = useState<Professional | null>(null)
  const [assigningTo, setAssigningTo] = useState<Professional | null>(null)

  // ── Filters ──
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const isDefaultFilters = search === '' && statusFilter === 'all'

  function resetFilters() {
    setSearch('')
    setStatusFilter('all')
  }

  function buildFilterLabel(): string {
    const parts: string[] = []
    const statusMap: Record<StatusFilter, string> = { all: 'todos', active: 'apenas ativos', inactive: 'apenas inativos' }
    parts.push(statusMap[statusFilter])
    if (search) parts.push(`busca: ${search}`)
    return parts.join(' · ')
  }

  const updateProfessional = useUpdateProfessional(editing?.id ?? '')

  const filtered = (data?.items ?? []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.active) ||
      (statusFilter === 'inactive' && !p.active)
    return matchesSearch && matchesStatus
  })

  async function handleCreate(formData: ProfessionalFormData) {
    try {
      await createProfessional.mutateAsync(toProfessionalPayload(formData))
      toast.success('Profissional criado')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar profissional')
    }
  }

  async function handleUpdate(formData: ProfessionalFormData) {
    try {
      await updateProfessional.mutateAsync(toProfessionalPayload(formData))
      toast.success('Profissional atualizado')
      setEditing(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar profissional')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProfessional.mutateAsync(id)
      toast.success('Profissional removido')
      setDeleting(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao remover profissional')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Profissionais</h2>
          <p className="text-sm text-muted-foreground">Gerencie a equipe da clínica</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserRound className="mr-1.5 h-4 w-4" />
          Novo Profissional
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="h-8 rounded-full border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Exibindo {buildFilterLabel()}</span>
          {!isDefaultFilters && (
            <button type="button" onClick={resetFilters} className="ml-auto shrink-0 font-medium text-primary hover:underline">
              Restaurar padrão
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <UserRound className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum profissional cadastrado.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreating(true)}>
            Criar primeiro profissional
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhum resultado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 pl-4 pr-2 text-left font-medium">Nome</th>
                <th className="hidden sm:table-cell px-2 py-3 text-left font-medium">Especialidade</th>
                <th className="hidden sm:table-cell px-2 py-3 text-left font-medium">E-mail</th>
                <th className="px-2 py-3 text-left font-medium">Status</th>
                <th className="px-2 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-medium">{p.name}</td>
                  <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">{p.speciality ?? '—'}</td>
                  <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">{p.email}</td>
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
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" title="Gerenciar serviços" onClick={() => setAssigningTo(p)}>
                        <ListChecks className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Editar profissional" onClick={() => setEditing(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Remover profissional"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
              defaultValues={fromProfessional(editing)}
              onSave={handleUpdate}
              isPending={updateProfessional.isPending}
              onDirtyChange={setFormDirty}
            />
          </div>
        </Dialog>
      )}

      {/* Delete dialog */}
      {deleting && (
        <Dialog open onClose={() => setDeleting(null)}>
          <DialogTitle>Remover Profissional</DialogTitle>
          <div className="mt-4">
            <DeleteProfessionalConfirm
              professional={deleting}
              onConfirm={() => handleDelete(deleting.id)}
              onCancel={() => setDeleting(null)}
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
