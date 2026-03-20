'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

type TransferState = 'loading' | 'success' | 'error'

function TransferConfirmContent() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const action = params.get('action') === 'reject' ? 'reject' : 'confirm'
  const [state, setState] = useState<TransferState>('loading')
  const [message, setMessage] = useState('Processando sua solicitação...')

  useEffect(() => {
    async function run() {
      if (!token) {
        setState('error')
        setMessage('Link inválido ou ausente.')
        return
      }

      try {
        const endpoint = action === 'confirm' ? '/auth/confirm-transfer' : '/auth/reject-transfer'
        const response = await api.post<{ message: string; clinicSlug?: string }>(`${endpoint}?token=${encodeURIComponent(token)}`)
        if (response.data.clinicSlug) {
          localStorage.setItem('clinic-slug', response.data.clinicSlug)
        }
        setState('success')
        setMessage(response.data.message)
      } catch (error: unknown) {
        const nextMessage =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Não foi possível concluir a solicitação.'
        setState('error')
        setMessage(nextMessage)
      }
    }

    void run()
  }, [action, token])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{state === 'loading' ? 'Processando...' : state === 'success' ? 'Solicitação concluída' : 'Não foi possível concluir'}</CardTitle>
        <CardDescription>
          {action === 'confirm' ? 'Confirmação de transferência de acesso' : 'Recusa de transferência de acesso'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild className="w-full" variant={state === 'success' ? 'default' : 'outline'}>
          <Link href="/login">Ir para o login</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function TransferConfirmPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<p className="text-center text-sm">Carregando...</p>}>
          <TransferConfirmContent />
        </Suspense>
      </div>
    </div>
  )
}