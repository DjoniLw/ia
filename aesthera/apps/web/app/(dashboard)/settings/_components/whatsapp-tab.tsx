'use client'

import { useState } from 'react'
import { CheckCircle, Loader2, RefreshCw, Smartphone, Unplug, XCircle } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  useWhatsappSettings,
  useUpdateWhatsappInstance,
  useWhatsappQrCode,
  useDisconnectWhatsapp,
} from '@/lib/hooks/use-resources'

// ─── Seção: conexão WhatsApp ───────────────────────────────────────────────────

function WhatsAppConnectionSection() {
  const { data, isLoading, refetch: refetchStatus } = useWhatsappSettings()
  const update = useUpdateWhatsappInstance()
  const disconnect = useDisconnectWhatsapp()

  const [instanceInput, setInstanceInput] = useState('')
  const [showQr, setShowQr] = useState(false)

  const {
    data: qr,
    isLoading: qrLoading,
    isError: qrError,
    refetch: refetchQr,
  } = useWhatsappQrCode(showQr && !!data?.configured)

  async function handleSaveInstance() {
    const instance = instanceInput.trim() || null
    await update.mutateAsync({ whatsappInstance: instance })
    setInstanceInput('')
    setShowQr(false)
  }

  async function handleDisconnect() {
    await disconnect.mutateAsync()
    setShowQr(false)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
      <div className="flex items-start gap-3">
        <Smartphone className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-base font-semibold">Conexão WhatsApp</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte o WhatsApp da sua clínica para enviar confirmações, lembretes e contratos
            automaticamente. Cada clínica usa seu próprio número.
          </p>
        </div>
      </div>

      {/* Status */}
      {data?.connected ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700/50 px-4 py-2.5 text-sm font-medium text-green-800 dark:text-green-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          WhatsApp conectado — instância <strong>{data.instance}</strong>
        </div>
      ) : data?.configured ? (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 px-4 py-2.5 text-sm text-yellow-700 dark:text-yellow-400">
          <XCircle className="h-4 w-4 shrink-0" />
          Instância <strong>{data.instance}</strong> configurada, mas não conectada.
          Escaneie o QR Code abaixo.
        </div>
      ) : null}

      {/* Campo de instância */}
      <div className="space-y-1.5">
        <Label htmlFor="wpp-instance">Nome da instância (Evolution API)</Label>
        <div className="flex gap-2">
          <Input
            id="wpp-instance"
            placeholder={data?.instance ?? 'ex: clinica-bella-01'}
            value={instanceInput}
            onChange={(e) => setInstanceInput(e.target.value)}
            className="h-9 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSaveInstance()}
            disabled={update.isPending}
          >
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Nome único para identificar esta clínica na Evolution API. Use letras minúsculas,
          números e hífens. Ex: <code className="bg-muted px-1 rounded">clinica-bella-01</code>
        </p>
      </div>

      {/* QR Code */}
      {data?.configured && !data.connected && (
        <div className="space-y-3">
          {!showQr ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQr(true)}
            >
              <Smartphone className="h-3.5 w-3.5 mr-1.5" />
              Conectar via QR Code
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void refetchQr()}
                  disabled={qrLoading}
                >
                  <RefreshCw className={['h-3.5 w-3.5', qrLoading ? 'animate-spin' : ''].join(' ')} />
                </Button>
              </div>
              {qrLoading && (
                <div className="flex items-center justify-center w-56 h-56 border rounded-xl bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {qrError && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <XCircle className="h-4 w-4" />
                  Falha ao carregar QR Code. Verifique a instância e tente novamente.
                </div>
              )}
              {qr?.base64 && !qrLoading && (
                <div className="space-y-2">
                  <Image
                    src={qr.base64}
                    alt="QR Code WhatsApp"
                    width={224}
                    height={224}
                    className="rounded-xl border"
                    unoptimized
                  />
                  <p className="text-xs text-muted-foreground">
                    O QR Code expira em ~60 segundos. Clique em{' '}
                    <button
                      onClick={() => void refetchQr()}
                      className="underline text-violet-600"
                    >
                      atualizar
                    </button>{' '}
                    se necessário.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refetchStatus()}
          disabled={isLoading}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Verificar status
        </Button>
        {(data?.connected || data?.configured) && (
          <Button
            variant={data?.connected ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => void handleDisconnect()}
            disabled={disconnect.isPending}
          >
            {disconnect.isPending
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <Unplug className="h-3.5 w-3.5 mr-1.5" />}
            {data?.connected ? 'Desconectar' : 'Remover instância'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Seção: automação de aniversários ─────────────────────────────────────────

function BirthdayAutomationSection() {
  const [enabled, setEnabled] = useState(false)
  const [sendTime, setSendTime] = useState('09:00')
  const [template, setTemplate] = useState(
    'Olá {nome}! 🎉\nA equipe da clínica deseja um feliz aniversário!\nComo presente, você ganhou {benefício}.\nEstamos aqui para te receber com muito carinho! 💜',
  )

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm opacity-70">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">Automação de Aniversários</h3>
            <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
              Em breve
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Envie mensagens automáticas de feliz aniversário via WhatsApp para seus clientes.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled />
      </div>

      {enabled && (
        <div className="mt-6 space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label>Horário de envio</Label>
            <input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              disabled
              className="bg-background text-foreground rounded-lg border px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-muted-foreground text-xs">
              O sistema enviará mensagens neste horário para todos os aniversariantes do dia.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Template da mensagem</Label>
            <p className="text-muted-foreground text-xs">
              Use{' '}
              <code className="bg-muted rounded px-1 py-0.5 font-mono">{'{nome}'}</code> para o
              nome do cliente e{' '}
              <code className="bg-muted rounded px-1 py-0.5 font-mono">{'{benefício}'}</code> para
              um benefício personalizado.
            </p>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled
              rows={5}
              className="bg-background text-foreground w-full resize-none rounded-lg border px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-muted-foreground text-xs">Prévia para &quot;Maria&quot;:</p>
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm whitespace-pre-wrap text-green-900 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-300">
              {template
                .replace('{nome}', 'Maria')
                .replace('{benefício}', '10% de desconto no próximo tratamento')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab principal ─────────────────────────────────────────────────────────────

export function WhatsAppTab() {
  return (
    <div className="mt-6 space-y-6">
      <WhatsAppConnectionSection />
      <BirthdayAutomationSection />
    </div>
  )
}
