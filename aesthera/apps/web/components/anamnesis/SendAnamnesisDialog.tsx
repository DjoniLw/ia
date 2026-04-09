'use client'

import { useState } from 'react'
import { Loader2, Mail, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { useAnamnesisGroups, type AnamnesisQuestion } from '@/lib/hooks/use-settings'
import { useCreateAnamnesisRequest } from '@/lib/hooks/use-resources'

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

  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [mode, setMode] = useState<'blank' | 'prefilled'>('blank')
  const [staffAnswers, setStaffAnswers] = useState<Record<string, string>>({})

  // ── Canais de envio (mesmo padrão do contrato) ─────────────────────────────
  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(true)
  const [sendViaEmail, setSendViaEmail] = useState(true)
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

  const answeredCount = questions.filter((q) => (staffAnswers[q.id] ?? '').toString().trim() !== '').length

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
    if (!selectedGroup) return false
    if (!sendViaWhatsapp && !sendViaEmail) return false
    if (sendViaWhatsapp && !phoneValid) return false
    if (sendViaEmail && !emailRegex.test(email.trim())) return false
    return true
  })()

  async function handleSend() {
    if (!selectedGroup || !canSend) return
    setError(null)
    try {
      await createRequest.mutateAsync({
        customerId,
        mode,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        questionsSnapshot: selectedGroup.questions.map((q) => ({ ...q })) as Record<string, unknown>[],
        staffAnswers: mode === 'prefilled' ? staffAnswers : undefined,
        phone: sendViaWhatsapp ? phone : undefined,
        email: sendViaEmail ? email.trim() : undefined,
      })
      onSuccess()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Erro ao criar solicitação. Tente novamente.')
    }
  }

  const isPending = createRequest.isPending

  return (
    <>
    <Dialog open onClose={onClose}>
      <DialogTitle>Enviar Anamnese</DialogTitle>
      <div className="space-y-5 mt-4">

        {/* Customer info */}
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
            <strong>Configurações → Anamnese</strong>.
          </p>
        ) : (
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
                    {m === 'blank' ? 'Paciente preenche' : 'Pré-preenchido'}
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

            {/* Canal de envio (mesmo padrão do contrato) */}
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enviar por</p>

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

              {/* E-mail */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="anamnesis-send-via-email"
                  checked={sendViaEmail}
                  onCheckedChange={setSendViaEmail}
                />
                <label htmlFor="anamnesis-send-via-email" className="flex items-center gap-2 cursor-pointer select-none">
                  <Mail className="h-4 w-4 text-violet-600 shrink-0" />
                  <span className="text-sm font-medium">E-mail</span>
                </label>
              </div>

              {sendViaEmail && (
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

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            {/* Ações */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!selectedGroup || !canSend || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Criar solicitação
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>

    {/* ── Modal de pré-preenchimento ─────────────────────────────── */}
    {showPrefillForm && (
      <Dialog open onClose={() => setShowPrefillForm(false)}>
        <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between rounded-t-xl z-10 -mx-6 -mt-6 mb-4">
          <p className="text-sm font-semibold">
            Pré-preencher — {selectedGroup?.name ?? 'Grupo'}
          </p>
          <button
            type="button"
            onClick={() => setShowPrefillForm(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[65vh] pb-2">
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

        <div className="flex justify-end pt-4 border-t mt-4">
          <Button size="sm" onClick={() => setShowPrefillForm(false)}>
            Confirmar respostas
          </Button>
        </div>
      </Dialog>
    )}
  </>
  )
}
