'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  staff: 'Recepcionista',
}

interface UserMe {
  id: string
  name: string
  email: string
  role: 'admin' | 'staff'
}

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
})
type ProfileData = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })
type PasswordData = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const qc = useQueryClient()
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const { data: user } = useQuery<UserMe>({
    queryKey: ['users', 'me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  })

  useEffect(() => {
    if (user?.name) profileForm.reset({ name: user.name })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name])

  const passwordForm = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const updateProfile = useMutation({
    mutationFn: (data: { name: string }) => api.patch('/users/me', data).then((r) => r.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', 'me'] })
      toast.success('Perfil atualizado com sucesso')
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao atualizar perfil'
      toast.error(msg)
    },
  })

  const updatePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/users/me', data).then((r) => r.data),
    onSuccess: () => {
      passwordForm.reset()
      setPasswordSuccess(true)
      toast.success('Senha alterada com sucesso')
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao alterar senha'
      passwordForm.setError('currentPassword', { message: msg })
    },
  })

  function onProfileSubmit(data: ProfileData) {
    updateProfile.mutate({ name: data.name })
  }

  function onPasswordSubmit(data: PasswordData) {
    setPasswordSuccess(false)
    updatePassword.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Meu Perfil</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Gerencie seus dados de acesso</p>
      </div>

      {/* Dados do Perfil */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Dados do Perfil</h3>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              {...profileForm.register('name')}
              placeholder="Seu nome"
            />
            {profileForm.formState.errors.name && (
              <p className="text-xs text-destructive">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email ?? ''} disabled readOnly className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
          </div>
          <div className="space-y-2">
            <Label>Perfil</Label>
            <Input
              value={user ? (ROLE_LABEL[user.role] ?? user.role) : ''}
              disabled
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfile.isPending || !profileForm.formState.isValid}
            >
              {updateProfile.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </div>

      {/* Trocar Senha */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Trocar Senha</h3>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <Input
              {...passwordForm.register('currentPassword')}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {passwordForm.formState.errors.currentPassword && (
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              {...passwordForm.register('newPassword')}
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input
              {...passwordForm.register('confirmPassword')}
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          {passwordSuccess && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-950/20 dark:text-green-400">
              Senha alterada com sucesso!
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updatePassword.isPending || !passwordForm.formState.isValid}
            >
              {updatePassword.isPending ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
