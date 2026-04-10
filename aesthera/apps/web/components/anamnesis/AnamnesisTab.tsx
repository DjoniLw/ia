'use client'

import { useState } from 'react'
import { Ban, ClipboardList, Eye, Loader2, Mail, MessageCircle, Plus, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { DataPagination } from '@/components/ui/data-pagination'
import {
  type AnamnesisRequest,
  type AnamnesisRequestStatus,
  useAnamnesisRequests,
  useCancelAnamnesis,
  useFinalizeAnamnesis,
  useSendAnamnesis,
} from '@/lib/hooks/use-resources'
import { ANAMNESIS_STATUS_COLORS, ANAMNESIS_STATUS_LABEL } from '@/lib/status-colors'
import { useRole } from '@/lib/hooks/use-role'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { AnamnesisDiffViewer } from './AnamnesisDiffViewer'

const STATUS_FILTER_VALUES: AnamnesisRequestStatus[] = [
  'pending', 'draft', 'clinic_filled', 'sent_to_client',
  'client_submitted', 'correction_requested', 'signed', 'expired', 'cancelled',
]
const STATUS_FILTER_OPTIONS: { value: AnamnesisRequestStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  ...STATUS_FILTER_VALUES.map((value) => ({ value, label: ANAMNESIS_STATUS_LABEL[value] ?? value })),
]

interface Props {
  customerId: string
  customerName: string
  defaultPhone?: string | null
  defaultEmail?: string | null
  onCreateNew: () => void
  onView: (req: AnamnesisRequest) => void
}

export function AnamnesisTab({
  customerId,
  customerName,
  defaultPhone,
  defaultEmail,
  onCreateNew,
  onView,
}: Props) {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<AnamnesisRequestStatus | ''>('')
  const [diffReq, setDiffReq] = useState<AnamnesisRequest | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendingMode, setSendingMode] = useState<'blank' | 'prefilled'>('blank')
  const [dispatchMode, setDispatchMode] = useState<'send' | 'save'>('send')
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [sendPhone, setSendPhone] = useState('')
  const [sendPhoneValid, setSendPhoneValid] = useState(false)
  const [sendPhoneError, setSendPhoneError] = useState('')
  const [sendEmail, setSendEmail] = useState('')
  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(true)
  const [sendViaEmail, setSendViaEmail] = useState(true)

  const role = useRole()
  const pageSize = 10

  const { data, isLoading } = useAnamnesisRequests({
    customerId,
    status: statusFilter || undefined,
    page,
    limit: pageSize,
  })

  const cancelAnamnesis = useCancelAnamnesis()
  const finalizeAnamnesis = useFinalizeAnamnesis()
  const sendAnamnesis = useSendAnamnesis()

  function openSendDialog(id: string, mode: 'blank' | 'prefilled') {
    setSendingId(id)
    setSendingMode(mode)
    setDispatchMode('send')
    setSendPhone(defaultPhone ?? '')
    setSendPhoneValid(false)
    setSendPhoneError('')
    setSendEmail(defaultEmail ?? '')
    setSendViaWhatsapp(Boolean(defaultPhone))
    setSendViaEmail(Boolean(defaultEmail))
  }

  function resetSendDialog() {
    setSendingId(null)
    setSendPhone('')
    setSendPhoneValid(false)
    setSendPhoneError('')
    setSendEmail('')
    setSendViaWhatsapp(true)
    setSendViaEmail(true)
  }

  function handleSendPhoneChange(e164: string, isValid: boolean) {
    setSendPhone(e164)
    setSendPhoneValid(isValid)
    if (e164.replace(/\D/g, '').length > 2) {
      setSendPhoneError(isValid ? '' : 'Número inválido — verifique o DDD e os dígitos')
    } else {
      setSendPhoneError('')
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const canSendNow = (() => {
    if (!sendViaWhatsapp && !sendViaEmail) return false
    if (sendViaWhatsapp && !sendPhoneValid) return false
    if (sendViaEmail && !emailRegex.test(sendEmail.trim())) return false
    return true
  })()

  async function handleCancel(id: string) {
    try {
      await cancelAnamnesis.mutateAsync(id)
      toast.success('Ficha cancelada.')
    } catch {
      toast.error('Erro ao cancelar. Tente novamente.')
    }
  }

  async function handleFinalize(id: string) {
    try {
      await finalizeAnamnesis.mutateAsync(id)
      toast.success('Ficha finalizada.')
    } catch {
      toast.error('Erro ao finalizar. Tente novamente.')
    }
  }

  async function handleSend(id: string) {
    try {
      await sendAnamnesis.mutateAsync({
        id,
        phone: sendViaWhatsapp ? sendPhone : undefined,
        email: sendViaEmail ? sendEmail.trim() : undefined,
      })
      toast.success('Ficha enviada ao cliente.')
      resetSendDialog()
    } catch {
      toast.error('Erro ao enviar. Tente novamente.')
    }
  }

  function buildDiffEntries(req: AnamnesisRequest) {
    const questions = (req.questionsSnapshot as Array<{ id: string; text: string; type: string }>) ?? []
    const staff = (req.staffAnswers ?? {}) as Record<string, string>
    const client = (req.clientAnswers ?? {}) as Record<string, string>
    return questions
      .filter((q) => q.type !== 'separator')
      .map((q) => ({
        questionId: q.id,
        question: q.text,
        clinicAnswer: staff[q.id] ?? '',
        clientAnswer: client[q.id] ?? '',
      }))
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">Fichas de Anamnese</p>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={onCreateNew}>
          <Plus className="h-3 w-3 mr-1" />
          Nova ficha
        </Button>
      </div>

      {/* Filtros por status */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setStatusFilter(opt.value); setPage(1) }}
            className={[
              'rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors',
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground hover:bg-muted/50',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.items.length ? (
        <div className="rounded-lg border bg-muted/10 px-3 py-8 text-center space-y-2">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            {statusFilter
              ? 'Nenhuma ficha com esse status.'
              : 'Nenhuma ficha de anamnese cadastrada.'}
          </p>
          {!statusFilter && (
            <Button size="sm" variant="outline" className="mx-auto text-xs" onClick={onCreateNew}>
              <Plus className="h-3 w-3 mr-1" />
              Nova ficha
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.items.map((req) => (
            <div key={req.id} className="rounded-lg border bg-card p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium truncate">{req.groupName}</p>
                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                    ANAMNESIS_STATUS_COLORS[req.status] ?? 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {ANAMNESIS_STATUS_LABEL[req.status] ?? req.status}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                {new Date(req.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
                {req.signedAt && ` · Assinada em ${new Date(req.signedAt).toLocaleDateString('pt-BR')}`}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => onView(req)}>
                  <Eye className="h-3 w-3" />
                  Ver
                </Button>

                {/* Finalizar rascunho */}
                {(req.status === 'draft' || req.status === 'pending') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    disabled={finalizeAnamnesis.isPending}
                    onClick={() => void handleFinalize(req.id)}
                  >
                    Finalizar rascunho
                  </Button>
                )}

                {/* Enviar ao cliente */}
                {['draft', 'pending', 'clinic_filled'].includes(req.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => openSendDialog(req.id, req.mode)}
                  >
                    <Send className="h-3 w-3" />
                    Enviar ao cliente
                  </Button>
                )}

                {/* Revisar respostas */}
                {req.status === 'client_submitted' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setDiffReq(req)}
                  >
                    Revisar respostas
                  </Button>
                )}

                {/* Cancelar — apenas admin */}
                {role === 'admin' && ['pending', 'sent_to_client', 'draft', 'clinic_filled', 'correction_requested'].includes(req.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                    disabled={cancelAnamnesis.isPending}
                    onClick={() => setCancelConfirmId(req.id)}
                  >
                    <Ban className="h-3 w-3" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(data?.total ?? 0) > pageSize && (
        <DataPagination
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={() => {}}
        />
      )}

      {/* Dialog "O que fazer com a ficha?" */}
      {sendingId && (
        <Dialog open onClose={resetSendDialog}>
          <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between rounded-t-xl z-10">
            <DialogTitle className="mb-0 text-sm">O que fazer com a ficha?</DialogTitle>
            <span className="text-[10px] text-muted-foreground">Etapa 2 de 2</span>
          </div>
          <div className="p-4 space-y-5">
            <p className="text-sm text-muted-foreground">
              Paciente: <strong>{customerName}</strong>
            </p>
            <div className="space-y-3">
              {/* Enviar ao cliente agora */}
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
                <input
                  type="radio"
                  name="tab-dispatch-mode"
                  value="send"
                  checked={dispatchMode === 'send'}
                  onChange={() => setDispatchMode('send')}
                  className="mt-0.5 shrink-0"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Enviar ao cliente agora</p>
                  <p className="text-xs text-muted-foreground">Gera um link seguro e notifica via WhatsApp ou e-mail.</p>
                </div>
              </label>

              {dispatchMode === 'send' && (
                <div className="ml-6 space-y-3 rounded-lg border p-4">
                  <p className="text-xs font-medium text-muted-foreground">Enviar por</p>

                  {/* WhatsApp */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="tab-dispatch-whatsapp"
                      checked={sendViaWhatsapp}
                      onCheckedChange={(v) => setSendViaWhatsapp(Boolean(v))}
                    />
                    <label htmlFor="tab-dispatch-whatsapp" className="flex items-center gap-2 cursor-pointer select-none">
                      <MessageCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="text-sm font-medium">WhatsApp</span>
                    </label>
                  </div>
                  {sendViaWhatsapp && (
                    <div className="ml-7 space-y-1.5">
                      <PhoneInput id="tab-dispatch-phone" value={sendPhone} onChange={handleSendPhoneChange} />
                      {sendPhoneError && <p className="text-xs text-red-500">{sendPhoneError}</p>}
                    </div>
                  )}

                  {/* E-mail */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="tab-dispatch-email"
                      checked={sendViaEmail}
                      onCheckedChange={(v) => setSendViaEmail(Boolean(v))}
                    />
                    <label htmlFor="tab-dispatch-email" className="flex items-center gap-2 cursor-pointer select-none">
                      <Mail className="h-4 w-4 text-violet-600 shrink-0" />
                      <span className="text-sm font-medium">E-mail</span>
                    </label>
                  </div>
                  {sendViaEmail && (
                    <div className="ml-7 space-y-1.5">
                      <Label htmlFor="tab-dispatch-email-input">E-mail do cliente</Label>
                      <Input
                        id="tab-dispatch-email-input"
                        type="email"
                        placeholder="cliente@exemplo.com"
                        value={sendEmail}
                        onChange={(e) => setSendEmail(e.target.value)}
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

              {/* Salvar para enviar depois */}
              <label
                className={[
                  'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                  sendingMode === 'blank'
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="tab-dispatch-mode"
                  value="save"
                  checked={dispatchMode === 'save'}
                  onChange={() => setDispatchMode('save')}
                  disabled={sendingMode === 'blank'}
                  className="mt-0.5 shrink-0"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Salvar para enviar depois</p>
                  <p className="text-xs text-muted-foreground">
                    {sendingMode === 'blank'
                      ? 'Disponível apenas no modo pré-preenchido.'
                      : 'Mantém a ficha salva com status "Preenchida pela clínica".'}
                  </p>
                </div>
              </label>
            </div>
          </div>
          <div className="sticky bottom-0 bg-card border-t px-4 py-3 flex justify-end gap-2 rounded-b-xl">
            <Button type="button" variant="outline" size="sm" onClick={resetSendDialog}>
              Cancelar
            </Button>
            {dispatchMode === 'send' ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSend(sendingId)}
                disabled={sendAnamnesis.isPending || !canSendNow}
              >
                {sendAnamnesis.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Enviar ao cliente
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => { resetSendDialog(); toast.success('Ficha salva. Envie ao cliente quando quiser.') }}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Salvar ficha
              </Button>
            )}
          </div>
        </Dialog>
      )}

      {/* Dialog de confirmação de cancelamento */}
      {cancelConfirmId && (
        <Dialog open onClose={() => setCancelConfirmId(null)}>
          <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between rounded-t-xl z-10">
            <DialogTitle className="mb-0 text-sm">Confirmar cancelamento</DialogTitle>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Tem certeza que deseja cancelar esta ficha de anamnese? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="sticky bottom-0 bg-card border-t px-4 py-3 flex justify-end gap-2 rounded-b-xl">
            <Button type="button" variant="outline" size="sm" onClick={() => setCancelConfirmId(null)}>
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={cancelAnamnesis.isPending}
              onClick={async () => {
                await handleCancel(cancelConfirmId)
                setCancelConfirmId(null)
              }}
            >
              {cancelAnamnesis.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </div>
        </Dialog>
      )}

      {/* Dialog de revisão de diff */}
      {diffReq && (
        <Dialog open onClose={() => setDiffReq(null)}>
          <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between rounded-t-xl z-10">
            <DialogTitle className="mb-0 text-sm">Revisar respostas — {diffReq.groupName}</DialogTitle>
          </div>
          <div className="p-4 overflow-y-auto max-h-[70vh]">
            <AnamnesisDiffViewer
              anamnesisId={diffReq.id}
              entries={buildDiffEntries(diffReq)}
              onResolved={() => setDiffReq(null)}
              onCancel={() => setDiffReq(null)}
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}
