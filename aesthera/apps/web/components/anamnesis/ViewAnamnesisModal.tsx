'use client'

import { ClipboardList, Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { type AnamnesisRequest, useAnamnesisRequestById } from '@/lib/hooks/use-resources'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  signed: 'Assinado',
  expired: 'Expirado',
  correction_requested: 'Correção solicitada',
  cancelled: 'Cancelado',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  signed: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-gray-100 text-gray-500',
  correction_requested: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-500',
}

interface QuestionEntry {
  id: string
  text: string
  type: string
}

function getAnswers(request: AnamnesisRequest): Record<string, unknown> {
  // clientAnswers tem prioridade; staffAnswers como fallback
  return (request.clientAnswers ?? request.staffAnswers ?? {}) as Record<string, unknown>
}

function renderAnswer(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

interface Props {
  request: AnamnesisRequest
  onClose: () => void
}

export function ViewAnamnesisModal({ request, onClose }: Props) {
  // Fetch full record (list endpoint omits questionsSnapshot/clientAnswers for perf)
  const { data: full, isLoading } = useAnamnesisRequestById(request.id)
  const record = full ?? request

  const questions = (record.questionsSnapshot ?? []) as unknown as QuestionEntry[]
  const answers = getAnswers(record)
  const signedDate = record.signedAt
    ? new Date(record.signedAt).toLocaleString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary shrink-0" />
        Ficha de Anamnese
      </DialogTitle>

      <div className="space-y-4 mt-4">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-medium">{record.customer.name}</p>
            <p className="text-xs text-muted-foreground">{record.groupName}</p>
          </div>
          <span
            className={[
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              STATUS_STYLE[record.status] ?? 'bg-gray-100 text-gray-500',
            ].join(' ')}
          >
            {STATUS_LABEL[record.status] ?? record.status}
          </span>
        </div>

        <hr />

        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : questions.filter((q) => q.type !== 'separator').length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem perguntas registradas.
          </p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {questions
              .filter((q) => q.type !== 'separator')
              .map((q) => (
                <div key={q.id} className="space-y-0.5">
                  <p className="text-xs font-medium text-foreground">{q.text}</p>
                  <p className="text-sm text-muted-foreground">{renderAnswer(answers[q.id])}</p>
                </div>
              ))}
          </div>
        )}

        {/* Assinatura */}
        {record.signature && (
          <>
            <hr />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                Assinatura do paciente
              </p>
              <div className="rounded-lg border bg-white p-2 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={record.signature}
                  alt="Assinatura do paciente"
                  className="max-h-24 object-contain"
                />
              </div>
              {signedDate && (
                <p className="text-xs text-muted-foreground text-center">
                  Assinado em {signedDate}
                </p>
              )}
            </div>
          </>
        )}

        {/* Ações */}
        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
