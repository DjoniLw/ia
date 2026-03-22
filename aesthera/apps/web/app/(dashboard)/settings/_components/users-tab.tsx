'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeactivateUser, useInviteUser, useUpdateUser, useUsers } from '@/lib/hooks/use-settings'

const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'staff']),
})
type InviteData = z.infer<typeof inviteSchema>

const ROLE_LABELS = { admin: 'Administrador', staff: 'Recepcionista' }

// ── Grupos de rotas para editor de permissões ─────────────────────────────────

interface PermissionGroup {
  label: string
  routes: { href: string; label: string }[]
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Atendimento',
    routes: [
      { href: '/appointments', label: 'Agendamentos' },
      { href: '/services', label: 'Serviços' },
      { href: '/professionals', label: 'Profissionais' },
      { href: '/customers', label: 'Clientes' },
    ],
  },
  {
    label: 'Espaço',
    routes: [
      { href: '/rooms', label: 'Salas' },
      { href: '/equipment', label: 'Equipamentos' },
    ],
  },
  {
    label: 'Estoque',
    routes: [
      { href: '/supplies', label: 'Insumos' },
      { href: '/compras-insumos', label: 'Compras de Insumos' },
      { href: '/products', label: 'Produtos' },
    ],
  },
  {
    label: 'Vendas',
    routes: [
      { href: '/sales', label: 'Vendas' },
      { href: '/promotions', label: 'Promoções' },
      { href: '/packages', label: 'Pacotes' },
      { href: '/carteira', label: 'Carteira' },
    ],
  },
  {
    label: 'Financeiro',
    routes: [
      { href: '/billing', label: 'Cobranças' },
      { href: '/financial', label: 'Financeiro' },
      { href: '/reports', label: 'Relatórios' },
    ],
  },
  {
    label: 'Comunicação',
    routes: [{ href: '/notifications', label: 'Notificações' }],
  },
]

// ── ScreenPermissionsEditor ───────────────────────────────────────────────────

interface ScreenPermissionsEditorProps {
  userId: string
  initialPermissions: string[]
  onClose: () => void
}

function ScreenPermissionsEditor({
  userId,
  initialPermissions,
  onClose,
}: ScreenPermissionsEditorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPermissions))
  const { mutateAsync: updateUser, isPending } = useUpdateUser()

  function toggleRoute(href: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  function toggleGroup(routes: { href: string }[]) {
    const hrefs = routes.map((r) => r.href)
    const allSelected = hrefs.every((h) => selected.has(h))
    setSelected((prev) => {
      const next = new Set(prev)
      hrefs.forEach((h) => (allSelected ? next.delete(h) : next.add(h)))
      return next
    })
  }

  async function handleSave() {
    const permissions = [...selected]
    try {
      await updateUser({ userId, data: { screenPermissions: permissions } })
      toast.success('Permissões salvas com sucesso')
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao salvar permissões'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecione quais telas este usuário pode acessar. <strong>/dashboard</strong> é sempre
        visível.
        {selected.size === 0 && (
          <span className="ml-1 text-amber-600">
            Nenhuma seleção = acesso padrão por perfil (sem restrição extra).
          </span>
        )}
      </p>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {/* Dashboard — sempre marcado */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked disabled readOnly className="h-4 w-4" />
            <span className="text-sm font-medium text-muted-foreground">
              Início (/dashboard) — sempre visível
            </span>
          </div>
        </div>

        {PERMISSION_GROUPS.map((group) => {
          const allSelected = group.routes.every((r) => selected.has(r.href))
          const someSelected = group.routes.some((r) => selected.has(r.href))
          return (
            <div key={group.label} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={() => toggleGroup(group.routes)}
                  className="h-4 w-4 cursor-pointer"
                />
                <span className="text-sm font-semibold text-foreground">{group.label}</span>
              </div>
              <div className="ml-6 space-y-1">
                {group.routes.map((route) => (
                  <label key={route.href} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(route.href)}
                      onChange={() => toggleRoute(route.href)}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="text-sm text-foreground">{route.label}</span>
                    <span className="text-xs text-muted-foreground">{route.href}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button onClick={() => void handleSave()} disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar permissões'}
        </Button>
      </div>
    </div>
  )
}

// ── UsersTab ──────────────────────────────────────────────────────────────────

interface EditingPermissions {
  userId: string
  userName: string
  permissions: string[]
}

export function UsersTab() {
  const { data: users, isLoading } = useUsers()
  const { mutateAsync: inviteUser, isPending: inviting } = useInviteUser()
  const { mutateAsync: deactivate } = useDeactivateUser()
  const [showForm, setShowForm] = useState(false)
  const [deactivating, setDeactivating] = useState<{ id: string; name: string } | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<EditingPermissions | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'staff' },
  })

  async function onInvite(data: InviteData) {
    try {
      const response = await inviteUser(data)
      toast.success(response?.message ?? `Convite enviado para ${data.email}`)
      reset()
      setShowForm(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao enviar convite'
      toast.error(msg)
    }
  }

  async function handleDeactivate(userId: string, name: string) {
    try {
      await deactivate(userId)
      toast.success(`${name} desativado`)
      setDeactivating(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao desativar usuário'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Pessoas com acesso ao painel da clínica</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : '+ Convidar'}
          </Button>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t pt-4">
            <form onSubmit={handleSubmit(onInvite)} className="grid grid-cols-3 gap-4 items-end">
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
                <Label>Perfil</Label>
                <select
                  {...register('role')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="staff">Recepcionista</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="col-span-3 flex justify-end">
                <Button type="submit" disabled={inviting}>
                  {inviting ? 'Enviando...' : 'Enviar convite'}
                </Button>
              </div>
            </form>
          </CardContent>
        )}

        <CardContent className={showForm ? 'pt-0' : undefined}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="divide-y">
              {users?.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-secondary text-secondary-foreground font-medium">
                      {ROLE_LABELS[user.role]}
                    </span>
                    {user.role === 'staff' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditingPermissions({
                            userId: user.id,
                            userName: user.name,
                            permissions: user.screenPermissions ?? [],
                          })
                        }
                      >
                        Permissões
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeactivating({ id: user.id, name: user.name })}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
              {users?.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {deactivating && (
        <Dialog open onClose={() => setDeactivating(null)}>
          <DialogTitle>Desativar Usuário</DialogTitle>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Desativar o acesso de <strong>{deactivating.name}</strong>? O usuário não poderá mais acessar o painel.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeactivating(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => handleDeactivate(deactivating.id, deactivating.name)}>
                Desativar
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {editingPermissions && (
        <Dialog open onClose={() => setEditingPermissions(null)}>
          <DialogTitle>Permissões de telas — {editingPermissions.userName}</DialogTitle>
          <div className="mt-4">
            <ScreenPermissionsEditor
              userId={editingPermissions.userId}
              initialPermissions={editingPermissions.permissions}
              onClose={() => setEditingPermissions(null)}
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}
