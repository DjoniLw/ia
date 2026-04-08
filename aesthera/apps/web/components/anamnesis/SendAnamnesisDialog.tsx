'use client'

import { useState } from 'react'
import { Loader2, Mail, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { useAnamnesisGroups, type AnamnesisQuestion } from '@/lib/hooks/use-settings'
import { useCreateAnamnesisRequest } from '@/lib/hooks/use-resources'

interface Props {
  customerId: string
  customerName: string
  onClose: () => void
  onSuccess: () => void
}

export function SendAnamnesisDialog({ customerId, customerName, onClose, onSuccess }: Props) {
  const { data: groups, isLoading: groupsLoading } = useAnamnesisGroups()

  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [mode, setMode] = useState<'blank' | 'prefilled'>('blank')
  const [staffAnswers, setStaffAnswers] = useState<Record<string, string>>({})
  const [channel, setChannel] = useState<'whatsapp' | 'email' | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const selectedGroup = groups?.find((g) => g.id === selectedGroupId) ?? groups?.[0] ?? null
  const questions = (selectedGroup?.questions ?? []).filter(
    (q): q is AnamnesisQuestion => q.type !== 'separator',
  )

  const createRequest = useCreateAnamnesisRequest()

  async function handleSend() {
    if (!selectedGroup) return
    setError(null)
    try {
      await createRequest.mutateAsync({
        customerId,
        mode,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        questionsSnapshot: selectedGroup.questions.map((q) => ({ ...q })) as Record<string, unknown>[],
        staffAnswers: mode === 'prefilled' ? staffAnswers : undefined,
        channel,
      })
      onSuccess()
    } catch {
      setError('Erro ao criar solicitação. Tente novamente.')
    }
  }

  const isPending = createRequest.isPending

  return (
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
                <select
                  value={selectedGroupId || groups[0]?.id}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value)
                    setStaffAnswers({})
                  }}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
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

            {/* Pré-preenchimento (modo prefilled) */}
            {mode === 'prefilled' && questions.length > 0 && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3 max-h-64 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Respostas do staff
                </p>
                {questions.map((q) => (
                  <div key={q.id} className="space-y-1">
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
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt) => {
                          const selected = (staffAnswers[q.id] ?? '').split(',').map((s) => s.trim()).includes(opt)
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                const current = (staffAnswers[q.id] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
                                const next = selected ? current.filter((s) => s !== opt) : [...current, opt]
                                setStaffAnswers((p) => ({ ...p, [q.id]: next.join(', ') }))
                              }}
                              className={[
                                'rounded-full px-3 py-1 text-xs border transition-colors',
                                selected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background hover:bg-muted/50',
                              ].join(' ')}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <input
                        type={q.type === 'numeric' ? 'number' : q.type === 'date' ? 'date' : 'text'}
                        value={staffAnswers[q.id] ?? ''}
                        onChange={(e) => setStaffAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                        className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Canal de envio */}
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Enviar link por (opcional)
              </p>
              <div className="flex gap-2">
                {(['whatsapp', 'email'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel((c) => (c === ch ? undefined : ch))}
                    className={[
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      channel === ch
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:bg-muted/50',
                    ].join(' ')}
                  >
                    {ch === 'whatsapp' ? (
                      <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Mail className="h-3.5 w-3.5 text-blue-500" />
                    )}
                    {ch === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                O link expira em 72 horas. Você pode reenviar depois se necessário.
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
                disabled={!selectedGroup || isPending}
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
  )
}
