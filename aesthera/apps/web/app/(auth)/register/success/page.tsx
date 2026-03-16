'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function SuccessContent() {
  const searchParams = useSearchParams()
  const slug = searchParams.get('slug') ?? ''
  const email = searchParams.get('email') ?? ''
  // Default to true so that direct navigation or old links without this param
  // still show the "check your inbox" message rather than the warning.
  const emailSent = searchParams.get('emailSent') !== 'false'

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl dark:bg-green-900/30">
          {emailSent ? '✉️' : '🎉'}
        </div>
        <CardTitle className="text-2xl">
          {emailSent ? 'Verifique seu e-mail' : 'Clínica cadastrada!'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-center">
        {emailSent ? (
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
              O serviço de e-mail ainda não está configurado. Entre em contato com o suporte ou
              configure a variável <code className="font-mono text-xs">RESEND_API_KEY</code> no
              painel do Railway para ativar os envios de e-mail.
            </p>
          </div>
        )}

        {slug && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-left">
            <p className="text-xs text-muted-foreground">Identificador da sua clínica</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">{slug}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Guarde este identificador — você precisará dele para fazer login.
            </p>
          </div>
        )}

        {emailSent && (
          <p className="text-xs text-muted-foreground">
            Não recebeu o e-mail? Verifique a caixa de spam ou{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              tente se cadastrar novamente
            </Link>
            .
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
