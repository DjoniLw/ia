'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ChangeEvent } from 'react'
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

function slugifyPreview(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

function applyCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
  .regex(/[0-9]/, 'Senha deve conter ao menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter ao menos um caractere especial')

const registerSchema = z
  .object({
    clinicDocument: z.string().refine((value: string) => {
      const digits = value.replace(/\D/g, '')
      return digits.length === 0 || digits.length === 14
    }, 'Informe um CNPJ válido com 14 dígitos ou deixe em branco.'),
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { clinicDocument: '' },
  })

  const clinicName = watch('clinicName') ?? ''
  const clinicDocument = watch('clinicDocument') ?? ''
  const slugPreview = clinicName.length >= 2 ? slugifyPreview(clinicName) : ''
  const clinicDocumentField = register('clinicDocument')

  function handleCnpjChange(event: ChangeEvent<HTMLInputElement>) {
    setValue('clinicDocument', applyCnpjMask(event.target.value), { shouldValidate: true })
  }

  async function onSubmit(data: RegisterData) {
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
        clinicDocument: data.clinicDocument || undefined,
        adminName: data.adminName,
        email: data.email,
        password: data.password,
        phone: data.phone,
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
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao cadastrar clínica'
      toast.error(message)
    } finally {
      setLoading(false)
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
            <Label htmlFor="clinicDocument">CNPJ da empresa (opcional)</Label>
            <Input
              id="clinicDocument"
              name={clinicDocumentField.name}
              ref={clinicDocumentField.ref}
              value={clinicDocument}
              onChange={handleCnpjChange}
              placeholder="00.000.000/0000-00"
            />
            <p className="text-xs text-muted-foreground">
              Você pode preencher depois em Configurações. Se informar agora, validaremos apenas o formato.
            </p>
            {errors.clinicDocument && <p className="text-sm text-destructive">{errors.clinicDocument.message}</p>}
          </div>

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
    </Card>
  )
}
