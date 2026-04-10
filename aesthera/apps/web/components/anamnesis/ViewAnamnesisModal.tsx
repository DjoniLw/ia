'use client'

import { AlertCircle, ClipboardList, Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { type AnamnesisRequest, useAnamnesisRequestById, useAnamnesisSignatureUrl } from '@/lib/hooks/use-resources'
import { ANAMNESIS_STATUS_LABEL, ANAMNESIS_STATUS_COLOR } from '@/lib/status-colors'

interface QuestionEntry {
  id: string
  text: string
  type: string
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
  // Fetch full record (list endpoint omits questionsSnapshot/clientAnswers para perf)
  const { data: full, isLoading, isError, refetch } = useAnamnesisRequestById(request.id)

  // Presigned URL para a assinatura — ativada apenas quando a ficha está assinada
  const hasSignature = Boolean((full as { signatureUrl?: string | null } | undefined)?.signatureUrl)
  const { data: signatureUrl } = useAnamnesisSignatureUrl(hasSignature ? request.id : null)

  // Questões e respostas vêm do full record; header usa request (sempre disponível)
  const questions = (full?.questionsSnapshot ?? []) as unknown as QuestionEntry[]
  // Fichas assinadas: staffAnswers contém respostas finais mescladas (após resolve-diff)
  // Fichas do cliente (sem staffAnswers): usa clientAnswers
  const answers = ((full?.staffAnswers ?? full?.clientAnswers ?? {}) as Record<string, unknown>)
  const signedDate = (full?.signedAt ?? request.signedAt)
    ? new Date((full?.signedAt ?? request.signedAt)!).toLocaleString('pt-BR', {
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
        {/* Cabeçalho — sempre visível imediatamente */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-medium">{request.customer.name}</p>
            <p className="text-xs text-muted-foreground">{request.groupName}</p>
          </div>
          <span
            className={[
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              ANAMNESIS_STATUS_COLOR[request.status] ?? 'bg-muted text-muted-foreground',
            ].join(' ')}
          >
            {ANAMNESIS_STATUS_LABEL[request.status] ?? request.status}
          </span>
        </div>

        <hr />

        {/* Corpo — aguarda full record */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar a ficha.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : questions.filter((q) => q.type !== 'separator').length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem perguntas registradas nesta ficha.
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
        {signatureUrl && (
          <>
            <hr />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                Assinatura do paciente
              </p>
              <div className="rounded-lg border bg-white p-2 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
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
