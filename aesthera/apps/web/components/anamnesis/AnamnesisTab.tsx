'use client'

import { useState } from 'react'
import { Ban, ClipboardList, Eye, Loader2, Plus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
  customerName: _customerName,
  defaultPhone,
  defaultEmail,
  onCreateNew,
  onView,
}: Props) {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<AnamnesisRequestStatus | ''>('')
  const [diffReq, setDiffReq] = useState<AnamnesisRequest | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [sendPhone, setSendPhone] = useState('')
  const [sendEmail, setSendEmail] = useState('')

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
      await sendAnamnesis.mutateAsync({ id, phone: sendPhone || undefined, email: sendEmail || undefined })
      toast.success('Ficha enviada ao cliente.')
      setSendingId(null)
      setSendPhone('')
      setSendEmail('')
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
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
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
                    onClick={() => { setSendingId(req.id); setSendPhone(defaultPhone ?? ''); setSendEmail(defaultEmail ?? '') }}
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

      {/* Dialog de envio ao cliente */}
      {sendingId && (
        <Dialog open onClose={() => { setSendingId(null); setSendPhone(''); setSendEmail('') }}>
          <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between rounded-t-xl z-10">
            <DialogTitle className="mb-0 text-sm">Enviar ficha ao cliente</DialogTitle>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Gere um link seguro e envie ao cliente via WhatsApp ou e-mail.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">WhatsApp (opcional)</label>
              <input
                type="tel"
                value={sendPhone}
                onChange={(e) => setSendPhone(e.target.value)}
                placeholder="+55 11 99999-9999"
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">E-mail (opcional)</label>
              <input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              />
            </div>
          </div>
          <div className="sticky bottom-0 bg-card border-t px-4 py-3 flex justify-end gap-2 rounded-b-xl">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setSendingId(null); setSendPhone(''); setSendEmail('') }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSend(sendingId)}
              disabled={sendAnamnesis.isPending}
            >
              {sendAnamnesis.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Enviar
            </Button>
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
