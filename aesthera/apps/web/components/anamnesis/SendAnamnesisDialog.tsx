'use client'

import { useState } from 'react'
import { ArrowLeft, ChevronRight, Loader2, Mail, MessageCircle, Save, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { useAnamnesisGroups, type AnamnesisQuestion } from '@/lib/hooks/use-settings'
import { useCreateAnamnesisRequest, useFinalizeAnamnesis, useSmtpSettings, useWhatsappSettings } from '@/lib/hooks/use-resources'

interface Props {
  customerId: string
  customerName: string
  defaultPhone?: string | null
  defaultEmail?: string | null
  onClose: () => void
  onSuccess: () => void
}

export function SendAnamnesisDialog({ customerId, customerName, defaultPhone, defaultEmail, onClose, onSuccess }: Props) {
  const { data: groups, isLoading: groupsLoading } = useAnamnesisGroups()
  const { data: smtpSettings } = useSmtpSettings()
  const { data: whatsappSettings } = useWhatsappSettings()
  const emailAvailable = Boolean(smtpSettings?.configured && smtpSettings?.enabled)
  const whatsappConnected = Boolean(whatsappSettings?.connected)

  // â”€â”€ Etapa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [step, setStep] = useState<'create' | 'dispatch'>('create')

  // â”€â”€ Etapa 1 â€” criar ficha â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [mode, setMode] = useState<'blank' | 'prefilled'>('blank')
  const [staffAnswers, setStaffAnswers] = useState<Record<string, string>>({})

  // â”€â”€ Etapa 2 â€” destino â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [dispatchMode, setDispatchMode] = useState<'send' | 'save'>('send')
  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(true)
  const [sendViaEmail, setSendViaEmail] = useState(emailAvailable)
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [phoneValid, setPhoneValid] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [email, setEmail] = useState(defaultEmail ?? '')

  const [error, setError] = useState<string | null>(null)
  const [showPrefillForm, setShowPrefillForm] = useState(false)

  const selectedGroup = groups?.find((g) => g.id === selectedGroupId) ?? groups?.[0] ?? null
  const questions = (selectedGroup?.questions ?? []).filter(
    (q): q is AnamnesisQuestion => q.type !== 'separator',
  )

  const createRequest = useCreateAnamnesisRequest()
  const finalizeAnamnesis = useFinalizeAnamnesis()

  const isPending = createRequest.isPending || finalizeAnamnesis.isPending

  // â”€â”€ ValidaÃ§Ãµes Etapa 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const requiredUnanswered = questions.filter(
    (q) => q.required && (staffAnswers[q.id] ?? '').toString().trim() === '',
  )
  const isStepOneValid = Boolean(
    selectedGroup && (mode === 'blank' || (mode === 'prefilled' && requiredUnanswered.length === 0)),
  )

  const answeredCount = questions.filter((q) => (staffAnswers[q.id] ?? '').toString().trim() !== '').length

  // â”€â”€ ValidaÃ§Ãµes Etapa 2 (envio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const canSend = (() => {
    if (!selectedGroup) return false
    if (!sendViaWhatsapp && !sendViaEmail) return false
    if (sendViaWhatsapp && !phoneValid) return false
    if (sendViaEmail && !emailRegex.test(email.trim())) return false
    return true
  })()

  function handlePhoneChange(e164: string, isValid: boolean) {
    setPhone(e164)
    setPhoneValid(isValid)
    if (e164.replace(/\D/g, '').length > 2) {
      setPhoneError(isValid ? '' : 'Número inválido — verifique o DDD e os dígitos')
    } else {
      setPhoneError('')
    }
  }

  // â”€â”€ AÃ§Ã£o: enviar ao cliente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSend() {
    if (!selectedGroup || !canSend) return
    setError(null)
    try {
      const result = await createRequest.mutateAsync({
        customerId,
        mode,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        questionsSnapshot: selectedGroup.questions.map((q) => ({ ...q })) as Record<string, unknown>[],
        staffAnswers: mode === 'prefilled' ? staffAnswers : undefined,
        phone: (sendViaWhatsapp && whatsappConnected) ? phone : undefined,
        email: sendViaEmail ? email.trim() : undefined,
      })

      // Fallback wa.me quando WhatsApp não está conectado
      if (sendViaWhatsapp && !whatsappConnected && result.signUrl) {
        const msg = encodeURIComponent(
          `Olá! A clínica enviou uma ficha de anamnese para você preencher.\n\n📋 ${selectedGroup.name}\n\nAcesse o link:\n${result.signUrl}\n\nO link expira em 7 dias.`
        )
        const phoneE164 = phone.replace('+', '')
        window.open(`https://wa.me/${phoneE164}?text=${msg}`, '_blank', 'noopener,noreferrer')
      }

      onSuccess()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Erro ao criar solicitação. Tente novamente.')
    }
  }

  // â”€â”€ AÃ§Ã£o: salvar sem enviar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSave() {
    if (!selectedGroup) return
    setError(null)
    try {
      const anamnesis = await createRequest.mutateAsync({
        customerId,
        mode: 'prefilled',
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        questionsSnapshot: selectedGroup.questions.map((q) => ({ ...q })) as Record<string, unknown>[],
        staffAnswers: staffAnswers,
        // sem phone/email — sem envio imediato
      })
      await finalizeAnamnesis.mutateAsync(anamnesis.id)
      toast.success('Ficha salva. Você pode enviá-la ao cliente a qualquer momento.')
      onSuccess()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Erro ao salvar ficha. Tente novamente.')
    }
  }

  function handleReset() {
    setStep('create')
    setSelectedGroupId('')
    setMode('blank')
    setStaffAnswers({})
    setDispatchMode('send')
    setError(null)
  }

  return (
    <>
    <Dialog open onClose={onClose}>
      <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between rounded-t-xl z-10">
        <div className="flex items-center gap-2">
          {step === 'dispatch' && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Voltar"
              onClick={() => { setStep('create'); setError(null) }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <DialogTitle className="mb-0 text-sm">
            {step === 'create' ? 'Nova ficha de anamnese' : 'O que fazer com a ficha?'}
          </DialogTitle>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicador de etapa */}
          <span className="text-[10px] text-muted-foreground">
            Etapa {step === 'create' ? '1' : '2'} de 2
          </span>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <p className="text-sm text-muted-foreground">
          Paciente: <strong>{customerName}</strong>
        </p>

        {groupsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !groups?.length ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Nenhum grupo de anamnese configurado. Configure em{' '}
            <strong>Configurações → Anamnese</strong>
          </p>
        ) : step === 'create' ? (
          /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
             ETAPA 1 â€” Criar ficha
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
          <>
            {/* Grupo */}
            {groups.length > 1 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium">Grupo de anamnese</label>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(g.id)
                        setStaffAnswers({})
                      }}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                        (selectedGroupId || groups[0]?.id) === g.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground hover:bg-muted/50',
                      ].join(' ')}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modo */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium">Modo de preenchimento</label>
              <div className="flex gap-2">
                {(['blank', 'prefilled'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={[
                      'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                      mode === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:bg-muted/50',
                    ].join(' ')}
                  >
                    {m === 'blank' ? 'Paciente preenche' : 'Pré-preenchido pela clínica'}
                  </button>
                ))}
              </div>
            </div>


            {/* Pré-preenchimento — abre modal separado */}
            {mode === 'prefilled' && questions.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium">Respostas pré-preenchidas</p>
                  <p className="text-xs text-muted-foreground">
                    {answeredCount} de {questions.length} pergunta{questions.length !== 1 ? 's' : ''} respondida{questions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" type="button" onClick={() => setShowPrefillForm(true)}>
                  Preencher respostas
                </Button>
              </div>
            )}
          </>
        ) : (
          /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
             ETAPA 2 â€” O que fazer com a ficha?
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
          <div className="space-y-3">
            {/* OpÃ§Ã£o: Enviar ao cliente agora */}
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
              <input
                type="radio"
                name="dispatchMode"
                value="send"
                checked={dispatchMode === 'send'}
                onChange={() => setDispatchMode('send')}
                className="mt-0.5 shrink-0"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">Enviar ao cliente agora</p>
                <p className="text-xs text-muted-foreground">Gera um link seguro e notifica via WhatsApp ou e-mail.</p>
              </div>
            </label>

            {/* Canais de envio â€” visÃ­veis apenas quando dispatchMode = send */}
            {dispatchMode === 'send' && (
              <div className="ml-6 space-y-3 rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground">Enviar por</p>

                {/* WhatsApp */}
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="anamnesis-send-via-whatsapp"
                    checked={sendViaWhatsapp}
                    onCheckedChange={setSendViaWhatsapp}
                  />
                  <label htmlFor="anamnesis-send-via-whatsapp" className="flex items-center gap-2 cursor-pointer select-none">
                    <MessageCircle className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </label>
                </div>
                {sendViaWhatsapp && (
                  <div className="ml-7 space-y-1.5">
                    <PhoneInput
                      id="anamnesis-send-phone"
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
                    id="anamnesis-send-via-email"
                    checked={sendViaEmail}
                    onCheckedChange={setSendViaEmail}
                    disabled={!emailAvailable}
                  />
                  <label htmlFor="anamnesis-send-via-email" className="flex items-center gap-2 cursor-pointer select-none">
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
                    <Label htmlFor="anamnesis-send-email">E-mail do cliente</Label>
                    <Input
                      id="anamnesis-send-email"
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

                <p className="text-xs text-muted-foreground pt-1">
                  O link expira em 7 dias. Você pode reenviar depois se necessário.
                </p>
              </div>
            )}

            {/* OpÃ§Ã£o: Salvar para enviar depois */}
            <label
              className={[
                'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                mode === 'blank' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5',
              ].join(' ')}
              title={mode === 'blank' ? 'Não é possível salvar uma ficha em branco sem enviar ao cliente.' : undefined}
            >
              <input
                type="radio"
                name="dispatchMode"
                value="save"
                checked={dispatchMode === 'save'}
                onChange={() => setDispatchMode('save')}
                disabled={mode === 'blank'}
                className="mt-0.5 shrink-0"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">Salvar para enviar depois</p>
                <p className="text-xs text-muted-foreground">
                  {mode === 'blank'
                    ? 'Disponível apenas no modo pré-preenchido.'
                    : 'Mantém a ficha salva com status "Preenchida pela clínica".'}
                </p>
              </div>
            </label>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* â”€â”€ RodapÃ© com aÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {groups && groups.length > 0 && (
        <div className="sticky bottom-0 bg-card border-t px-4 py-3 flex justify-between gap-2 rounded-b-xl">
          <Button variant="outline" size="sm" onClick={step === 'create' ? onClose : handleReset} disabled={isPending}>
            {step === 'create' ? 'Cancelar' : 'Recomeçar'}
          </Button>
          <div className="flex gap-2">
            {step === 'create' ? (
              <Button
                size="sm"
                onClick={() => setStep('dispatch')}
                disabled={!isStepOneValid}
              >
                Avançar
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : dispatchMode === 'send' ? (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!canSend || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Enviar ao cliente
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Salvar ficha
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>

    {/* ── Modal de pré-preenchimento ─────────────────────────────── */}
    {showPrefillForm && (
      <Dialog open onClose={() => setShowPrefillForm(false)}>
        <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between rounded-t-xl z-10">
          <p className="text-sm font-semibold">
            Pré-preencher — {selectedGroup?.name ?? 'Grupo'}
          </p>
          {/* eslint-disable-next-line aesthera/no-native-button */}
          <button
            type="button"
            onClick={() => setShowPrefillForm(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[65vh] pb-2 pr-1 p-4">
          {questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <label className="text-xs font-medium">
                {q.text}
                {q.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {q.type === 'yesno' ? (
                <div className="flex gap-2">
                  {['Sim', 'Não'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setStaffAnswers((p) => ({ ...p, [q.id]: opt }))}
                      className={[
                        'rounded-full px-3 py-1 text-xs border transition-colors',
                        staffAnswers[q.id] === opt
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted/50',
                      ].join(' ')}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : q.type === 'multiple' && q.options ? (
                <div className="space-y-1">
                  {(q.options ?? []).map((opt, idx) => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(staffAnswers[q.id] ?? '').split(',').map((s) => s.trim()).filter(Boolean).includes(opt)}
                        onChange={(e) => {
                          const current = (staffAnswers[q.id] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
                          const next = e.target.checked ? [...current, opt] : current.filter((s) => s !== opt)
                          setStaffAnswers((p) => ({ ...p, [q.id]: next.join(', ') }))
                        }}
                      />
                      {(q.optionImages ?? [])[idx] && (
                        <img src={(q.optionImages ?? [])[idx]!} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                      )}
                      {opt}
                    </label>
                  ))}
                  {(q.options ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhuma alternativa configurada.</p>
                  )}
                </div>
              ) : q.type === 'select' ? (
                <div className="space-y-2">
                  {(q.selectOptions ?? []).map((opt) => (
                    <div key={opt.label} className="space-y-1">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`prefill-select-${q.id}`}
                          value={opt.label}
                          checked={staffAnswers[q.id] === opt.label}
                          onChange={() => {
                            setStaffAnswers((p) => {
                              const next = { ...p, [q.id]: opt.label }
                              if (!opt.withDescription) delete next[q.id + '__desc']
                              return next
                            })
                          }}
                        />
                        {opt.imageUrl && (
                          <img src={opt.imageUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                        )}
                        {opt.label}
                      </label>
                      {opt.withDescription && staffAnswers[q.id] === opt.label && (
                        <textarea
                          value={staffAnswers[q.id + '__desc'] ?? ''}
                          onChange={(e) => setStaffAnswers((p) => ({ ...p, [q.id + '__desc']: e.target.value }))}
                          rows={2}
                          placeholder="Descreva…"
                          className="ml-6 w-[calc(100%-1.5rem)] rounded-md border bg-background px-2 py-1 text-sm resize-none"
                        />
                      )}
                    </div>
                  ))}
                  {(q.selectOptions ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhuma alternativa configurada.</p>
                  )}
                </div>
              ) : (
                <input
                  type={q.type === 'numeric' ? 'number' : q.type === 'date' ? 'date' : 'text'}
                  value={staffAnswers[q.id] ?? ''}
                  onChange={(e) => setStaffAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                  className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-card border-t px-4 py-3 flex justify-end rounded-b-xl">
          <Button size="sm" onClick={() => setShowPrefillForm(false)}>
            Confirmar respostas
          </Button>
        </div>
      </Dialog>
    )}
    </>
  )
}
