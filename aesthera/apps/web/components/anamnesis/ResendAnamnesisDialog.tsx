'use client'

import { useState } from 'react'
import { Loader2, Mail, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { useResendAnamnesis, type AnamnesisRequest } from '@/lib/hooks/use-resources'

interface Props {
  request: AnamnesisRequest
  defaultPhone?: string | null
  defaultEmail?: string | null
  onClose: () => void
  onSuccess: () => void
}

export function ResendAnamnesisDialog({ request, defaultPhone, defaultEmail, onClose, onSuccess }: Props) {
  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(true)
  const [sendViaEmail, setSendViaEmail] = useState(true)
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [phoneValid, setPhoneValid] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [email, setEmail] = useState(defaultEmail ?? '')

  const resendAnamnesis = useResendAnamnesis()

  function handlePhoneChange(e164: string, isValid: boolean) {
    setPhone(e164)
    setPhoneValid(isValid)
    if (e164.replace(/\D/g, '').length > 2) {
      setPhoneError(isValid ? '' : 'Número inválido — verifique o DDD e os dígitos')
    } else {
      setPhoneError('')
    }
  }

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
      await resendAnamnesis.mutateAsync({
        id: request.id,
        phone: sendViaWhatsapp ? phone : undefined,
        email: sendViaEmail ? email.trim() : undefined,
      })
      onSuccess()
    } catch {
      // erro tratado no chamador via toast
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Reenviar Anamnese</DialogTitle>
      <div className="space-y-5 mt-4">
        <p className="text-sm text-muted-foreground">
          Ficha: <strong>{request.groupName}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Um novo link será gerado e enviado ao paciente. O link anterior será invalidado.
        </p>

        {/* Checkboxes de canais */}
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enviar por</p>

          {/* WhatsApp */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="resend-anamnesis-via-whatsapp"
              checked={sendViaWhatsapp}
              onCheckedChange={setSendViaWhatsapp}
            />
            <label htmlFor="resend-anamnesis-via-whatsapp" className="flex items-center gap-2 cursor-pointer select-none">
              <MessageCircle className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm font-medium">WhatsApp</span>
            </label>
          </div>

          {sendViaWhatsapp && (
            <div className="ml-7 space-y-1.5">
              <PhoneInput
                id="resend-anamnesis-phone"
                value={phone}
                onChange={handlePhoneChange}
              />
              {phoneError && (
                <p className="text-xs text-red-500">{phoneError}</p>
              )}
            </div>
          )}

          {/* E-mail */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="resend-anamnesis-via-email"
              checked={sendViaEmail}
              onCheckedChange={setSendViaEmail}
            />
            <label htmlFor="resend-anamnesis-via-email" className="flex items-center gap-2 cursor-pointer select-none">
              <Mail className="h-4 w-4 text-violet-600 shrink-0" />
              <span className="text-sm font-medium">E-mail</span>
            </label>
          </div>

          {sendViaEmail && (
            <div className="ml-7 space-y-1.5">
              <Label htmlFor="resend-anamnesis-email">E-mail do cliente</Label>
              <Input
                id="resend-anamnesis-email"
                type="email"
                placeholder="cliente@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}

          {!sendViaWhatsapp && !sendViaEmail && (
            <p className="text-xs text-red-500">Selecione ao menos um canal de envio.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={resendAnamnesis.isPending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSend()}
            disabled={resendAnamnesis.isPending || !canSend}
          >
            {resendAnamnesis.isPending
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Reenviar link
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
