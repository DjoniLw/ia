'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

interface Company {
  id: string
  name: string
  document: string
  email: string
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)

  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ['company-me'],
    queryFn: async () => {
      const { data } = await api.get('/companies/me')
      return data
    },
  })

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const form = new FormData(e.currentTarget)
      await api.patch('/companies/me', { name: form.get('name') })
      toast.success('Empresa atualizada com sucesso!')
    } catch {
      toast.error('Erro ao salvar as alterações')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Empresa</h2>
        <p className="text-muted-foreground">Gerencie os dados da sua empresa</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da empresa</CardTitle>
          <CardDescription>Atualize os dados cadastrais da sua empresa</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da empresa</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={company?.name}
                  placeholder="Minha Empresa Ltda"
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={company?.document ?? ''} disabled readOnly />
                <p className="text-xs text-muted-foreground">O CNPJ não pode ser alterado</p>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={company?.email ?? ''} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  Para alterar o e-mail, entre em contato com o suporte
                </p>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
