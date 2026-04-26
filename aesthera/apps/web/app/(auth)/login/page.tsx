'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { clearTokens, getRefreshToken, setTokens, setTokensAuto, setTokensSession } from '@/lib/auth'

const REMEMBER_KEY = 'aesthera-keep-signed-in'

function sanitizeRedirect(raw: string | null): string {
  if (!raw) return '/dashboard'
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    try {
      const url = new URL(raw, window.location.origin)
      if (url.origin === window.location.origin) return raw
    } catch {
      // URL inválida — cai no fallback
    }
  }
  return '/dashboard'
}

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

type LoginData = z.infer<typeof loginSchema>
type SlugStatus = 'idle' | 'loading' | 'resolved' | 'unresolved'
type LoginPageState = 'checking' | 'idle'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pageState, setPageState] = useState<LoginPageState>('checking')
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const resolveAbortRef = useRef<AbortController | null>(null)

  const [remember, setRemember] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(REMEMBER_KEY)
    return stored === null ? true : stored !== 'false'
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) })

  const emailField = register('email')

  async function resolveSlug(email: string) {
    if (!z.string().email().safeParse(email).success) {
      setResolvedSlug(null)
      setSlugStatus('idle')
      return
    }

    resolveAbortRef.current?.abort()
    resolveAbortRef.current = new AbortController()
    setSlugStatus('loading')

    try {
      const response = await api.get<{ slug: string | null }>(
        `/auth/resolve-slug?email=${encodeURIComponent(email)}`,
        { signal: resolveAbortRef.current.signal },
      )

      if (response.data.slug) {
        setResolvedSlug(response.data.slug)
        setSlugStatus('resolved')
        return
      }

      setResolvedSlug(null)
      setSlugStatus('unresolved')
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'CanceledError'
      if (!aborted) {
        setResolvedSlug(null)
        setSlugStatus('idle')
      }
    }
  }

  useEffect(() => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      setPageState('idle')
      return
    }

    api
      .post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken })
      .then(({ data }) => {
        setTokensAuto(data.accessToken, data.refreshToken)
        const redirect = new URLSearchParams(window.location.search).get('redirect')
        router.push(sanitizeRedirect(redirect))
      })
      .catch(() => {
        clearTokens()
        setPageState('idle')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(data: LoginData) {
    if (!resolvedSlug) {
      toast.error('Não foi possível identificar sua clínica automaticamente. Verifique o e-mail e tente novamente.')
      return
    }

    setLoading(true)
    try {
      localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
      localStorage.setItem('clinic-slug', resolvedSlug)
      const response = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/login',
        { email: data.email, password: data.password },
        { headers: { 'X-Clinic-Slug': resolvedSlug } },
      )

      if (remember) {
        setTokens(response.data.accessToken, response.data.refreshToken)
      } else {
        clearTokens()
        setTokensSession(response.data.accessToken, response.data.refreshToken)
      }

      toast.success('Login realizado com sucesso!')
      const redirect = new URLSearchParams(window.location.search).get('redirect')
      router.push(sanitizeRedirect(redirect))
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao fazer login'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (pageState === 'checking') {
    return <p className="text-center text-sm text-muted-foreground">Verificando sua sessão...</p>
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
            <Label htmlFor="email">E-mail</Label>
            <Input
              {...emailField}
              id="email"
              type="email"
              placeholder="voce@clinica.com"
              autoComplete="email"
              onBlur={(event) => {
                void emailField.onBlur(event)
                void resolveSlug(event.target.value)
              }}
            />
            {slugStatus === 'loading' && (
              <p className="text-xs text-muted-foreground">Identificando sua clínica...</p>
            )}
            {slugStatus === 'resolved' && (
              <p className="text-xs text-green-600 dark:text-green-400">Clínica identificada automaticamente.</p>
            )}
            {slugStatus === 'unresolved' && (
              <p className="text-xs text-muted-foreground">
                Não foi possível identificar a clínica automaticamente. Revise o e-mail informado.
              </p>
            )}
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <label htmlFor="remember" className="cursor-pointer text-sm text-muted-foreground">
              Manter conectado
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={loading || slugStatus === 'loading'}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Cadastre sua clínica
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
