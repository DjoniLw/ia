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

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl dark:bg-green-900/30">
          ✉️
        </div>
        <CardTitle className="text-2xl">Verifique seu e-mail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-center">
        <p className="text-sm text-muted-foreground">
          Enviamos um e-mail de confirmação para{' '}
          {email && <span className="font-medium text-foreground">{email}</span>}.
          Clique no link para ativar sua conta.
        </p>

        {slug && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-left">
            <p className="text-xs text-muted-foreground">Identificador da sua clínica</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">{slug}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Guarde este identificador — você precisará dele para fazer login.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Não recebeu o e-mail? Verifique a caixa de spam ou{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            tente se cadastrar novamente
          </Link>
          .
        </p>

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
