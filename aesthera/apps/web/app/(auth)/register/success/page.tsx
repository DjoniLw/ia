'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

function SuccessContent() {
  const searchParams = useSearchParams()
  const slug = searchParams.get('slug') ?? ''
  const email = searchParams.get('email') ?? ''
  const mode = searchParams.get('mode') ?? 'verification'
  // Default to true so that direct navigation or old links without this param
  // still show the "check your inbox" message rather than the warning.
  const emailSent = searchParams.get('emailSent') !== 'false'

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // Transfer resend state
  const [resendingTransfer, setResendingTransfer] = useState(false)
  const [resentTransfer, setResentTransfer] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(() =>
    mode === 'transfer' && Boolean(email) ? 60 : 0,
  )

  // Decrement cooldown every second
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldownSeconds])

  async function handleResend() {
    if (!email || resending) return
    setResending(true)
    try {
      const res = await api.post<{ sent: boolean }>('/auth/resend-verification', { email })
      if (res.data.sent) {
        setResent(true)
        toast.success('E-mail de verificação reenviado!')
      } else {
        toast.error(
          'Não foi possível reenviar o e-mail. O serviço de e-mail pode não estar configurado.',
        )
      }
    } catch {
      toast.error('Erro ao reenviar o e-mail. Tente novamente.')
    } finally {
      setResending(false)
    }
  }

  async function handleResendTransfer() {
    if (!email || resendingTransfer || cooldownSeconds > 0) return
    setResendingTransfer(true)
    try {
      const res = await api.post<{ sent: boolean }>('/auth/resend-transfer', { email })
      if (res.data.sent) {
        setResentTransfer(true)
        setCooldownSeconds(60)
        toast.success('E-mail de transferência reenviado!')
      } else {
        toast.error(
          'Não foi possível reenviar o e-mail. O serviço de e-mail pode não estar configurado.',
        )
      }
    } catch (error: unknown) {
      const errData = (
        error as { response?: { data?: { message?: string; data?: { secondsRemaining?: number } } } }
      )?.response?.data
      const seconds = errData?.data?.secondsRemaining
      if (seconds) {
        setCooldownSeconds(seconds)
      }
      toast.error(errData?.message ?? 'Erro ao reenviar. Tente novamente.')
    } finally {
      setResendingTransfer(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl dark:bg-green-900/30">
          {mode === 'transfer' ? '↔️' : emailSent ? '✉️' : '🎉'}
        </div>
        <CardTitle className="text-2xl">
          {mode === 'transfer' ? 'Confirme a transferência do acesso' : emailSent ? 'Verifique seu e-mail' : 'Clínica cadastrada!'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-center">
        {mode === 'transfer' ? (
          <p className="text-sm text-muted-foreground">
            Enviamos um e-mail para <span className="font-medium text-foreground">{email}</span> com os links para confirmar ou recusar a transferência do seu acesso para a nova clínica.
          </p>
        ) : emailSent ? (
          <p className="text-sm text-muted-foreground">
            Enviamos um e-mail de confirmação para{' '}
            {email && <span className="font-medium text-foreground">{email}</span>}.
            Clique no link para ativar sua conta.
          </p>
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-left text-sm dark:border-yellow-900/40 dark:bg-yellow-900/20">
            <p className="font-medium text-yellow-800 dark:text-yellow-300">
              E-mail de confirmação não enviado
            </p>
            <p className="mt-1 text-yellow-700 dark:text-yellow-400">
              O serviço de e-mail ainda não está configurado. Quando o serviço for ativado, use o
              botão abaixo para reenviar o e-mail — ou{' '}
              <Link href="/register" className="font-medium underline">
                cadastre-se novamente
              </Link>{' '}
              para atualizar suas informações.
            </p>
          </div>
        )}

        {slug && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-left">
            <p className="text-xs text-muted-foreground">Identificador interno da clínica</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">{slug}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O sistema usará esse identificador automaticamente durante o login.
            </p>
          </div>
        )}

        {mode === 'transfer' && email && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleResendTransfer}
            disabled={resendingTransfer || cooldownSeconds > 0}
          >
            {resendingTransfer
              ? 'Reenviando...'
              : cooldownSeconds > 0
                ? `Reenviar em ${cooldownSeconds}s`
                : 'Reenviar e-mail de transferência'}
          </Button>
        )}

        {resentTransfer && (
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ E-mail de transferência reenviado! Verifique sua caixa de entrada e a pasta de spam.
          </p>
        )}

        {mode !== 'transfer' && email && !resent && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? 'Reenviando...' : 'Reenviar e-mail de verificação'}
          </Button>
        )}

        {resent && (
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ E-mail reenviado! Verifique sua caixa de entrada e a pasta de spam.
          </p>
        )}

        {mode !== 'transfer' && emailSent && !resent && (
          <p className="text-xs text-muted-foreground">
            Não recebeu o e-mail? Verifique a caixa de spam ou use o botão acima.
          </p>
        )}

        <Button asChild className="w-full" variant="outline">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function RegisterSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}
