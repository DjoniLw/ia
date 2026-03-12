'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

function AcceptInviteForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    try {
      await api.post('/users/accept-invite', { token, password: data.password })
      toast.success('Conta criada! Faça login para continuar.')
      router.push('/login')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Link inválido ou expirado'
      toast.error(msg)
    }
  }

  if (!token) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Link de convite inválido ou ausente.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar senha</CardTitle>
        <CardDescription>Defina uma senha para acessar o painel</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Confirmar senha</Label>
            <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Criar conta'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<p className="text-center text-sm">Carregando...</p>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  )
}
