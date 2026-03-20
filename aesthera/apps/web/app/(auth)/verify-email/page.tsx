'use client'

import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { setTokens } from '@/lib/auth'

type VerifyState = 'loading' | 'success' | 'error'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [state, setState] = useState<VerifyState>('loading')
  const [slug, setSlug] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cancel pending redirect on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setState('error')
      setErrorMsg('Token de verificação não encontrado.')
      return
    }

    api
      .post<{ accessToken: string; refreshToken: string; clinic: { slug: string } }>(
        '/auth/verify-email',
        { token },
      )
      .then((res) => {
        const clinicSlug = res.data.clinic.slug
        setSlug(clinicSlug)
        localStorage.setItem('clinic-slug', clinicSlug)
        setTokens(res.data.accessToken, res.data.refreshToken)
        setState('success')
        redirectTimerRef.current = setTimeout(() => router.push('/dashboard'), 3000)
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Link inválido ou expirado.'
        setErrorMsg(msg)
        setState('error')
      })
  }, [token, router])

  function handleGoToDashboard() {
    if (redirectTimerRef.current !== null) {
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = null
    }
    router.push('/dashboard')
  }

  if (state === 'loading') {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verificando seu e-mail…</p>
        </CardContent>
      </Card>
    )
  }

  if (state === 'success') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl dark:bg-green-900/30">
            ✅
          </div>
          <CardTitle className="text-2xl">E-mail confirmado!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sua conta foi ativada com sucesso. Redirecionando para o painel…
          </p>
          {slug && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-left">
              <p className="text-xs text-muted-foreground">Identificador da clínica</p>
              <p className="font-mono font-semibold text-foreground">{slug}</p>
            </div>
          )}
          <Button className="w-full" onClick={handleGoToDashboard}>
            Ir para o painel
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl dark:bg-red-900/30">
          ❌
        </div>
        <CardTitle className="text-2xl">Verificação falhou</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{errorMsg}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/register">Cadastrar novamente</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  )
}
