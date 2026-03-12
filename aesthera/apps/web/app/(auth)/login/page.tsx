'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { setTokens } from '@/lib/auth'

const loginSchema = z.object({
  clinicSlug: z.string().min(1, 'Slug da clínica é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

type LoginData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginData) {
    setLoading(true)
    try {
      localStorage.setItem('clinic-slug', data.clinicSlug)
      const response = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/login',
        { email: data.email, password: data.password },
      )
      setTokens(response.data.accessToken, response.data.refreshToken)
      toast.success('Login realizado com sucesso!')
      router.push('/dashboard')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao fazer login'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Acessar painel</CardTitle>
        <CardDescription>Entre com seu e-mail e senha para continuar</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicSlug">Slug da clínica</Label>
            <Input
              id="clinicSlug"
              placeholder="clinica-bella-vita"
              autoComplete="off"
              {...register('clinicSlug')}
            />
            {errors.clinicSlug && (
              <p className="text-sm text-destructive">{errors.clinicSlug.message}</p>
            )}
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Não tem conta?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Cadastrar clínica
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
