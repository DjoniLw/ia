'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const forgotSchema = z.object({
  email: z.string().email('E-mail inválido'),
})

type ForgotData = z.infer<typeof forgotSchema>
type PageState = 'idle' | 'loading' | 'success' | 'error'

export default function ForgotPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('idle')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotData>({ resolver: zodResolver(forgotSchema) })

  async function onSubmit(data: ForgotData) {
    setPageState('loading')
    try {
      await api.post('/auth/forgot-password', { email: data.email })
      setPageState('success')
    } catch {
      setPageState('error')
    }
  }

  if (pageState === 'success') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl dark:bg-green-900/30">
            ✉️
          </div>
          <CardTitle className="text-2xl">E-mail enviado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Se esse e-mail estiver cadastrado no sistema, você receberá as instruções para redefinir sua senha em
            breve. Verifique também a caixa de spam.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Voltar para o login</Link>
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
          <CardTitle className="text-2xl">Erro ao enviar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro ao tentar enviar o e-mail de recuperação. Tente novamente mais tarde.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Voltar para o login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Recuperar senha</CardTitle>
        <CardDescription>
          Informe seu e-mail de cadastro e enviaremos as instruções para redefinir sua senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="voce@clinica.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={pageState === 'loading'}>
            {pageState === 'loading' ? 'Enviando...' : 'Enviar instruções'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Lembrou a senha?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Voltar para o login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
