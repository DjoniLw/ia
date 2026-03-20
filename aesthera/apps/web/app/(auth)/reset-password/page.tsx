'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'next/navigation'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'A senha deve ter no mínimo 8 caracteres')
      .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
      .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
      .regex(/[^A-Za-z0-9]/, 'A senha deve conter pelo menos um caractere especial'),
    confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type ResetData = z.infer<typeof resetSchema>
type PageState = 'idle' | 'loading' | 'success' | 'error'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [pageState, setPageState] = useState<PageState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetData>({ resolver: zodResolver(resetSchema) })

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl dark:bg-red-900/30">
            ❌
          </div>
          <CardTitle className="text-2xl">Link inválido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            O link de redefinição de senha está incompleto ou é inválido. Solicite um novo link de recuperação.
          </p>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Solicitar novo link</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (pageState === 'success') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl dark:bg-green-900/30">
            ✅
          </div>
          <CardTitle className="text-2xl">Senha redefinida!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sua senha foi alterada com sucesso. Você já pode fazer login com a nova senha.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (pageState === 'error') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl dark:bg-red-900/30">
            ❌
          </div>
          <CardTitle className="text-2xl">Link inválido ou expirado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {errorMsg || 'O link de redefinição de senha expirou ou já foi utilizado. Solicite um novo.'}
          </p>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Solicitar novo link</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Voltar para o login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  async function onSubmit(data: ResetData) {
    setPageState('loading')
    try {
      await api.post('/auth/reset-password', { token, password: data.password })
      setPageState('success')
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'O link de redefinição de senha expirou ou já foi utilizado. Solicite um novo.'
      setErrorMsg(msg)
      setPageState('error')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Redefinir senha</CardTitle>
        <CardDescription>Escolha uma nova senha para a sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={pageState === 'loading'}>
            {pageState === 'loading' ? 'Salvando...' : 'Salvar nova senha'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Voltar para o login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
