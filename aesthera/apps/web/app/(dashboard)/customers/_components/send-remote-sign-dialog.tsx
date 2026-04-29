'use client'

import { useState, useEffect } from 'react'
import { Loader2, Mail, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { useSendRemoteSignLink, useSmtpSettings, useWhatsappSettings, type CustomerContract } from '@/lib/hooks/use-resources'

interface Props {
  contract: CustomerContract
  defaultPhone?: string | null
  defaultEmail?: string | null
  onClose: () => void
  onSuccess: () => void
}

export function SendRemoteSignDialog({ contract, defaultPhone, defaultEmail, onClose, onSuccess }: Props) {
  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(true)
  const [sendViaEmail, setSendViaEmail] = useState(true)
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [phoneValid, setPhoneValid] = useState(false)
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [phoneError, setPhoneError] = useState('')

  const { data: smtpSettings } = useSmtpSettings()
  const { data: whatsappSettings } = useWhatsappSettings()
  const emailAvailable = Boolean(smtpSettings?.configured && smtpSettings?.enabled)
  const whatsappConnected = Boolean(whatsappSettings?.connected)

  // Ajustar sendViaEmail quando smtpSettings carregar
  useEffect(() => {
    if (smtpSettings !== undefined) {
      setSendViaEmail(emailAvailable)
    }
  }, [emailAvailable, smtpSettings])

  const sendRemoteSign = useSendRemoteSignLink(contract.customerId, contract.id)

  function handlePhoneChange(e164: string, isValid: boolean) {
    setPhone(e164)
    setPhoneValid(isValid)
    if (e164.replace(/\D/g, '').length > 2) {
      setPhoneError(isValid ? '' : 'Número inválido — verifique o DDD e os dígitos')
    } else {
      setPhoneError('')
    }
  }

  // Validação de envio
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const canSend = (() => {
    if (!sendViaWhatsapp && !sendViaEmail) return false
    if (sendViaWhatsapp && !phoneValid) return false
    if (sendViaEmail && !emailRegex.test(email.trim())) return false
    return true
  })()

  async function handleSend() {
    if (!canSend) return
    try {
      const result = await sendRemoteSign.mutateAsync({
        phone: sendViaWhatsapp ? phone : undefined,
        email: sendViaEmail ? email.trim() : undefined,
      })

      // Fallback wa.me quando WhatsApp não está conectado
      if (sendViaWhatsapp && !whatsappConnected && result?.signUrl) {
        const contractName = contract.label ?? contract.template?.name ?? 'contrato'
        const msg = encodeURIComponent(
          `Você recebeu um contrato para assinar: *${contractName}*.\n\nAcesse:\n${result.signUrl}\n\nO link expira em 48 horas.`
        )
        const phoneE164 = phone.replace('+', '')
        window.open(`https://wa.me/${phoneE164}?text=${msg}`, '_blank', 'noopener,noreferrer')
      }

      onSuccess()
    } catch {
      // erro tratado na página pai via toast
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Enviar para assinar</DialogTitle>
      <div className="space-y-5 mt-4">
        <p className="text-sm text-muted-foreground">
          Contrato: <strong>{contract.label ?? contract.template?.name ?? '—'}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          O cliente receberá um link para assinar diretamente pelo celular. O link expira em 48 horas.
        </p>

        {/* Checkboxes de canais */}
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enviar por</p>

          {/* WhatsApp */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="send-via-whatsapp"
              checked={sendViaWhatsapp}
              onCheckedChange={setSendViaWhatsapp}
            />
            <label htmlFor="send-via-whatsapp" className="flex items-center gap-2 cursor-pointer select-none">
              <MessageCircle className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm font-medium">WhatsApp</span>
            </label>
          </div>

          {sendViaWhatsapp && (
            <div className="ml-7 space-y-1.5">
              <PhoneInput
                id="remote-sign-phone"
                value={phone}
                onChange={handlePhoneChange}
              />
              {phoneError && (
                <p className="text-xs text-red-500">{phoneError}</p>
              )}
            </div>
          )}
          {sendViaWhatsapp && !whatsappConnected && (
            <p className="ml-7 text-xs text-amber-600 flex items-center gap-1">
              <span>&#9888;</span> WhatsApp não conectado — o link será aberto via WhatsApp Web.
            </p>
          )}

          {/* E-mail */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="send-via-email"
              checked={sendViaEmail}
              onCheckedChange={setSendViaEmail}
              disabled={!emailAvailable}
            />
            <label htmlFor="send-via-email" className="flex items-center gap-2 cursor-pointer select-none">
              <Mail className="h-4 w-4 text-violet-600 shrink-0" />
              <span className="text-sm font-medium">E-mail</span>
            </label>
          </div>

          {!emailAvailable && (
            <p className="ml-7 text-xs text-muted-foreground">
              E-mail não configurado.{' '}
              <a href="/settings?tab=email" className="underline text-violet-600">Configure em Configurações → E-mail</a>
            </p>
          )}
          {sendViaEmail && emailAvailable && (
            <div className="ml-7 space-y-1.5">
              <Label htmlFor="remote-sign-email">E-mail do cliente</Label>
              <Input
                id="remote-sign-email"
                type="email"
                placeholder="cliente@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>

        {!sendViaWhatsapp && !sendViaEmail && (
          <p className="text-xs text-red-500">Selecione ao menos um canal de envio.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sendRemoteSign.isPending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSend()}
            disabled={sendRemoteSign.isPending || !canSend}
          >
            {sendRemoteSign.isPending
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Enviar link
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
