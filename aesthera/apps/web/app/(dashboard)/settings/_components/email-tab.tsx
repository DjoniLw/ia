'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Loader2, Mail, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSmtpSettings, useUpdateSmtpSettings, useTestSmtpSettings } from '@/lib/hooks/use-resources'

export function EmailTab() {
  const { data, isLoading } = useSmtpSettings()
  const update = useUpdateSmtpSettings()
  const test = useTestSmtpSettings()

  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [from, setFrom] = useState('')
  const [secure, setSecure] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [testError, setTestError] = useState('')

  useEffect(() => {
    if (!data) return
    setHost(data.smtpHost ?? '')
    setPort(String(data.smtpPort ?? 587))
    setUser(data.smtpUser ?? '')
    setFrom(data.smtpFrom ?? '')
    setSecure(data.smtpSecure)
    setEnabled(data.enabled ?? true)
  }, [data])

  async function handleSave() {
    await update.mutateAsync({
      smtpHost: host.trim() || null,
      smtpPort: port ? Number(port) : null,
      smtpUser: user.trim() || null,
      smtpPass: pass.trim() || null,
      smtpFrom: from.trim() || null,
      smtpSecure: secure,
      smtpEnabled: enabled,
    })
    setPass('')
    toast.success('Configurações de e-mail salvas.')
  }

  async function handleTest() {
    setTestResult(null)
    setTestError('')
    try {
      await test.mutateAsync()
      setTestResult('ok')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Falha na conexão'
      setTestResult('error')
      setTestError(msg)
    }
  }

  if (isLoading) {
    return (
      <div className="mt-6 flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-semibold">E-mail da clínica</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure seu Gmail, Outlook ou outro provedor SMTP para que os e-mails saiam
              diretamente do endereço da sua clínica.
            </p>
          </div>
        </div>

        {data?.configured && (
          <div className="flex items-center gap-2 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700/50 px-4 py-2.5 text-sm font-medium text-green-800 dark:text-green-300">
            <CheckCircle className="h-4 w-4 shrink-0" />
            E-mail configurado — envios usam o servidor da sua clínica.
          </div>
        )}

        {data?.configured && (
          <div className="flex items-center gap-3">
            <Switch
              id="smtp-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="smtp-enabled" className="text-sm cursor-pointer">
              Habilitar envio por e-mail
            </Label>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="smtp-host">Servidor SMTP</Label>
            <Input
              id="smtp-host"
              placeholder="smtp.gmail.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-port">Porta</Label>
            <Input
              id="smtp-port"
              type="number"
              placeholder="587"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-user">Usuário / E-mail</Label>
            <Input
              id="smtp-user"
              type="email"
              placeholder="contato@suaclinica.com.br"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-pass">Senha de app</Label>
            <Input
              id="smtp-pass"
              type="password"
              placeholder={data?.configured ? '••••••••••••' : 'Senha ou senha de app'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Para Gmail: use uma{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-violet-600"
              >
                senha de app
              </a>{' '}
              (necessário 2FA ativo).
            </p>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="smtp-from">Nome/E-mail de exibição (remetente)</Label>
            <Input
              id="smtp-from"
              placeholder='Clínica Bella <contato@clinicabella.com.br>'
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Como o destinatário verá o remetente. Ex: <code className="bg-muted px-1 rounded">Clínica Bella &lt;contato@clinicabella.com.br&gt;</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="smtp-secure"
            checked={secure}
            onCheckedChange={setSecure}
          />
          <Label htmlFor="smtp-secure" className="text-sm text-muted-foreground cursor-pointer">
            SSL/TLS (porta 465) — desative para STARTTLS (porta 587)
          </Label>
        </div>

        {testResult === 'ok' && (
          <div className="flex items-center gap-2 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700/50 px-4 py-2.5 text-sm font-medium text-green-800 dark:text-green-300">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Conexão bem-sucedida! O servidor SMTP está acessível.
          </div>
        )}
        {testResult === 'error' && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{testError}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleTest()}
              disabled={test.isPending || !data?.configured}
            >
              {test.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Testar conexão
            </Button>
            {!data?.configured && (
              <p className="text-xs text-muted-foreground">Salve as configurações primeiro para habilitar o teste.</p>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={update.isPending}
          >
            {update.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-2">
        <h4 className="text-sm font-semibold">Configurações por provedor</h4>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Gmail:</strong> smtp.gmail.com · porta 465 (SSL) ou 587 (STARTTLS) · requer senha de app</p>
          <p><strong>Outlook / Hotmail:</strong> smtp.office365.com · porta 587 (STARTTLS)</p>
          <p><strong>Yahoo:</strong> smtp.mail.yahoo.com · porta 465 (SSL)</p>
          <p><strong>Zoho:</strong> smtp.zoho.com · porta 465 (SSL)</p>
        </div>
      </div>
    </div>
  )
}
