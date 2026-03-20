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
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { setTokens } from '@/lib/auth'

function slugifyPreview(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
  .regex(/[0-9]/, 'Senha deve conter ao menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter ao menos um caractere especial')

const registerSchema = z
  .object({
    clinicName: z.string().min(2, 'Nome da clínica deve ter ao menos 2 caracteres'),
    adminName: z.string().min(2, 'Seu nome deve ter ao menos 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: passwordSchema,
    confirmPassword: z.string(),
    phone: z.string().optional(),
  })
  .refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type RegisterData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [recoverLoading, setRecoverLoading] = useState(false)
  const [resendTransferLoading, setResendTransferLoading] = useState(false)
  const [conflictDialog, setConflictDialog] = useState<{
    type: 'admin' | 'member' | 'slug_linked' | 'transfer_pending'
    clinicName: string
  } | null>(null)
  const [pendingFormData, setPendingFormData] = useState<RegisterData | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  })

  const clinicName = watch('clinicName') ?? ''
  const slugPreview = clinicName.length >= 2 ? slugifyPreview(clinicName) : ''

  async function submitRegister(data: RegisterData, confirmTransfer = false) {
    setLoading(true)
    try {
      const response = await api.post<{
        clinic: { slug: string; name: string; id: string }
        emailVerificationSent: boolean
        autoVerified?: boolean
        accessToken?: string
        refreshToken?: string
        transferPending?: boolean
      }>('/auth/register', {
        clinicName: data.clinicName,
        adminName: data.adminName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        ...(confirmTransfer ? { confirmTransfer: true } : {}),
      })

      const slug = response.data.clinic.slug
      if (response.data.autoVerified && response.data.accessToken && response.data.refreshToken) {
        localStorage.setItem('clinic-slug', slug)
        setTokens(response.data.accessToken, response.data.refreshToken)
        toast.success('Clínica cadastrada com sucesso!')
        const base = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'localhost:3001'
        window.location.href = `${window.location.protocol}//${slug}.${base}/dashboard`
        return
      }

      const mode = response.data.transferPending ? 'transfer' : 'verification'
      router.push(`/register/success?mode=${mode}&slug=${encodeURIComponent(slug)}&email=${encodeURIComponent(data.email)}&emailSent=${response.data.emailVerificationSent !== false}`)
    } catch (error: unknown) {
      const errResp = (error as { response?: { data?: { error?: string; message?: string; data?: { clinicName?: string } } } })?.response?.data
      const errCode = errResp?.error
      if (errCode === 'EMAIL_CONFLICT_ADMIN' || errCode === 'EMAIL_CONFLICT_MEMBER') {
        setPendingFormData(data)
        setConflictDialog({
          type: errCode === 'EMAIL_CONFLICT_ADMIN' ? 'admin' : 'member',
          clinicName: errResp?.data?.clinicName ?? '',
        })
        return
      }
      if (errCode === 'SLUG_LINKED_SAME_CLINIC') {
        setPendingFormData(data)
        setConflictDialog({
          type: 'slug_linked',
          clinicName: errResp?.data?.clinicName ?? '',
        })
        return
      }
      if (errCode === 'TRANSFER_PENDING') {
        setPendingFormData(data)
        setConflictDialog({ type: 'transfer_pending', clinicName: '' })
        return
      }
      toast.error(errResp?.message ?? 'Erro ao cadastrar clínica')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(data: RegisterData) {
    await submitRegister(data)
  }

  async function handleConfirmTransfer() {
    if (!pendingFormData) return
    setConflictDialog(null)
    await submitRegister(pendingFormData, true)
  }

  async function handleRecoverAccess() {
    if (!pendingFormData) return
    setRecoverLoading(true)
    try {
      await api.post('/auth/recover-access', { email: pendingFormData.email })
      setConflictDialog(null)
      toast.success('E-mail de recuperação enviado. Verifique sua caixa de entrada.')
    } catch {
      toast.error('Não foi possível enviar o e-mail de recuperação.')
    } finally {
      setRecoverLoading(false)
    }
  }

  async function handleResendTransferFromDialog() {
    if (!pendingFormData) return
    setResendTransferLoading(true)
    try {
      const res = await api.post<{ sent: boolean }>('/auth/resend-transfer', {
        email: pendingFormData.email,
      })
      setConflictDialog(null)
      if (res.data.sent) {
        router.push(
          `/register/success?mode=transfer&email=${encodeURIComponent(pendingFormData.email)}`,
        )
      } else {
        toast.error(
          'Não foi possível reenviar o e-mail. O serviço de e-mail pode não estar configurado.',
        )
      }
    } catch (error: unknown) {
      const errData = (error as { response?: { data?: { message?: string } } })?.response?.data
      toast.error(errData?.message ?? 'Erro ao reenviar. Tente novamente.')
    } finally {
      setResendTransferLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Cadastrar clínica</CardTitle>
        <CardDescription>Crie sua conta e comece agora mesmo</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicName">Nome da clínica</Label>
            <Input id="clinicName" placeholder="Clínica Estética" {...register('clinicName')} />
            {slugPreview && (
              <p className="text-xs text-muted-foreground">
                Identificador interno gerado: <span className="font-mono font-medium text-foreground">{slugPreview}</span>
              </p>
            )}
            {errors.clinicName && <p className="text-sm text-destructive">{errors.clinicName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminName">Seu nome</Label>
            <Input id="adminName" placeholder="Ana Silva" {...register('adminName')} />
            {errors.adminName && <p className="text-sm text-destructive">{errors.adminName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="voce@clinica.com" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (opcional)</Label>
            <Input id="phone" type="tel" placeholder="(11) 91234-5678" {...register('phone')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, com letra maiúscula, número e caractere especial.
            </p>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Criar conta'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Fazer login
          </Link>
        </p>
      </CardContent>

      {conflictDialog && (
        <Dialog open onClose={() => setConflictDialog(null)}>
          {conflictDialog.type === 'transfer_pending' ? (
            <>
              <DialogTitle>Transferência pendente</DialogTitle>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Já existe um e-mail de transferência pendente para{' '}
                <strong className="text-foreground">{pendingFormData?.email}</strong>. Deseja reenviar
                o e-mail de confirmação de transferência?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConflictDialog(null)}
                  disabled={resendTransferLoading}
                >
                  Cancelar
                </Button>
                <Button onClick={handleResendTransferFromDialog} disabled={resendTransferLoading}>
                  {resendTransferLoading ? 'Reenviando...' : 'Reenviar e-mail de transferência'}
                </Button>
              </div>
            </>
          ) : conflictDialog.type === 'slug_linked' ? (
            <>
              <DialogTitle>Você já possui vínculo com esta empresa</DialogTitle>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Você já possui vínculo com a empresa{' '}
                <strong className="text-foreground">{conflictDialog.clinicName}</strong>, que tem o
                mesmo identificador que você está tentando cadastrar. Deseja recuperar o acesso à
                sua conta?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConflictDialog(null)}
                  disabled={recoverLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleRecoverAccess}
                  disabled={recoverLoading}
                >
                  {recoverLoading ? 'Enviando...' : 'Recuperar acesso'}
                </Button>
              </div>
            </>
          ) : conflictDialog.type === 'admin' ? (
            <>
              <DialogTitle>Você já é administrador desta clínica</DialogTitle>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Você já é administrador da clínica{' '}
                <strong className="text-foreground">{conflictDialog.clinicName}</strong>. Se continuar
                com o cadastro de{' '}
                <strong className="text-foreground">{pendingFormData?.clinicName}</strong>, será
                transferido e <strong className="text-foreground">perderá acesso</strong> à{' '}
                <strong className="text-foreground">{conflictDialog.clinicName}</strong>.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={handleRecoverAccess}
                  disabled={recoverLoading || loading}
                >
                  {recoverLoading ? 'Enviando...' : `Recuperar acesso à ${conflictDialog.clinicName}`}
                </Button>
                <Button onClick={handleConfirmTransfer} disabled={loading || recoverLoading}>
                  {loading ? 'Cadastrando...' : `Continuar com nova clínica`}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogTitle>E-mail já cadastrado em outra clínica</DialogTitle>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Este e-mail já está cadastrado na clínica{' '}
                <strong className="text-foreground">{conflictDialog.clinicName}</strong>. Deseja criar
                a nova clínica{' '}
                <strong className="text-foreground">{pendingFormData?.clinicName}</strong> e se
                transferir?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConflictDialog(null)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button onClick={handleConfirmTransfer} disabled={loading}>
                  {loading ? 'Cadastrando...' : 'Sim, criar nova clínica'}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </Card>
  )
}
