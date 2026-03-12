'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type Customer,
  useCreateCustomer,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
} from '@/lib/hooks/use-resources'

// ──── Schema ───────────────────────────────────────────────────────────────────

const customerSchema = z
  .object({
    name: z.string().min(2, 'Nome obrigatório'),
    email: z.string().email('E-mail inválido').optional().or(z.literal('')),
    phone: z.string().optional(),
    document: z.string().optional(),
    birthDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => d.email || d.phone, {
    message: 'Informe e-mail ou telefone',
    path: ['email'],
  })

type CustomerFormData = z.infer<typeof customerSchema>

// ──── CustomerForm ─────────────────────────────────────────────────────────────

function CustomerForm({
  defaultValues,
  onSave,
  isPending,
}: {
  defaultValues?: Partial<CustomerFormData>
  onSave: (data: CustomerFormData) => Promise<void>
  isPending: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input {...register('name')} placeholder="Maria Silva" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input {...register('email')} type="email" placeholder="maria@email.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input {...register('phone')} placeholder="+55 11 99999-9999" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>CPF / Documento</Label>
          <Input {...register('document')} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-2">
          <Label>Data de nascimento</Label>
          <Input {...register('birthDate')} type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input {...register('notes')} placeholder="Alergia a látex…" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useCustomers(search ? { name: search } : undefined)
  const createCustomer = useCreateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  const updateCustomer = useUpdateCustomer(editing?.id ?? '')

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  async function handleCreate(formData: CustomerFormData) {
    try {
      await createCustomer.mutateAsync({
        ...formData,
        email: formData.email || null,
        phone: formData.phone || null,
        document: formData.document || null,
        birthDate: formData.birthDate || null,
        notes: formData.notes || null,
      })
      toast.success('Cliente criado')
      setCreating(false)
    } catch {
      toast.error('Erro ao criar cliente')
    }
  }

  async function handleUpdate(formData: CustomerFormData) {
    try {
      await updateCustomer.mutateAsync({
        ...formData,
        email: formData.email || null,
        phone: formData.phone || null,
        document: formData.document || null,
        birthDate: formData.birthDate || null,
        notes: formData.notes || null,
      })
      toast.success('Cliente atualizado')
      setEditing(null)
    } catch {
      toast.error('Erro ao atualizar cliente')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente?')) return
    try {
      await deleteCustomer.mutateAsync(id)
      toast.success('Cliente removido')
    } catch {
      toast.error('Erro ao remover cliente')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clientes</h2>
          <p className="text-sm text-muted-foreground">Base de clientes da clínica</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Novo Cliente</Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-3 pl-4 pr-2 text-left font-medium">Nome</th>
              <th className="px-2 py-3 text-left font-medium">E-mail</th>
              <th className="px-2 py-3 text-left font-medium">Telefone</th>
              <th className="px-2 py-3 text-left font-medium">CPF</th>
              <th className="px-2 py-3 text-left font-medium">Cadastro</th>
              <th className="px-2 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
            {data?.items.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 pl-4 pr-2 font-medium">{c.name}</td>
                <td className="px-2 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                <td className="px-2 py-3 text-muted-foreground">{c.phone ?? '—'}</td>
                <td className="px-2 py-3 text-muted-foreground">{c.document ?? '—'}</td>
                <td className="px-2 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                <td className="px-2 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(c.id)}
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
        <Dialog open onClose={() => setCreating(false)}>
          <DialogTitle>Novo Cliente</DialogTitle>
          <div className="mt-4">
            <CustomerForm onSave={handleCreate} isPending={createCustomer.isPending} />
          </div>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open onClose={() => setEditing(null)}>
          <DialogTitle>Editar Cliente</DialogTitle>
          <div className="mt-4">
            <CustomerForm
              defaultValues={{
                ...editing,
                email: editing.email ?? '',
                phone: editing.phone ?? '',
                document: editing.document ?? '',
                birthDate: editing.birthDate?.slice(0, 10) ?? '',
                notes: editing.notes ?? '',
              }}
              onSave={handleUpdate}
              isPending={updateCustomer.isPending}
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}
