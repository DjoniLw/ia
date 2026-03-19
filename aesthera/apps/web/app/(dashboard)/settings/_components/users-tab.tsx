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
import { useDeactivateUser, useInviteUser, useUsers } from '@/lib/hooks/use-settings'

const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'staff']),
})
type InviteData = z.infer<typeof inviteSchema>

const ROLE_LABELS = { admin: 'Administrador', staff: 'Recepcionista' }

export function UsersTab() {
  const { data: users, isLoading } = useUsers()
  const { mutateAsync: inviteUser, isPending: inviting } = useInviteUser()
  const { mutateAsync: deactivate } = useDeactivateUser()
  const [showForm, setShowForm] = useState(false)
  const [deactivating, setDeactivating] = useState<{ id: string; name: string } | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'staff' },
  })

  async function onInvite(data: InviteData) {
    try {
      await inviteUser(data)
      toast.success(`Convite enviado para ${data.email}`)
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
    </div>
  )
}
