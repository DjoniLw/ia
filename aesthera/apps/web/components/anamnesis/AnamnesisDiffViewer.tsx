'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useResolveAnamnesisDiff } from '@/lib/hooks/use-resources'
import { Button } from '@/components/ui/button'

interface DiffEntry {
  questionId: string
  question: string
  clinicAnswer: string
  clientAnswer: string
}

interface Props {
  anamnesisId: string
  entries: DiffEntry[]
  onResolved: () => void
  onCancel: () => void
}

export function AnamnesisDiffViewer({ anamnesisId, entries, onResolved, onCancel }: Props) {
  const [resolutions, setResolutions] = useState<Record<string, 'clinic' | 'client'>>({})
  const resolveDiff = useResolveAnamnesisDiff()

  const divergent = entries.filter((e) => e.clinicAnswer !== e.clientAnswer)
  const allResolved = divergent.length === 0 || divergent.every((e) => resolutions[e.questionId])

  function acceptAll(source: 'clinic' | 'client') {
    const all: Record<string, 'clinic' | 'client'> = {}
    for (const entry of divergent) {
      all[entry.questionId] = source
    }
    setResolutions(all)
  }

  async function handleConfirm() {
    if (!allResolved) return
    const allResolutions: Record<string, 'clinic' | 'client'> = {}
    for (const entry of entries) {
      allResolutions[entry.questionId] = resolutions[entry.questionId] ?? 'clinic'
    }
    try {
      await resolveDiff.mutateAsync({ id: anamnesisId, resolutions: allResolutions })
      toast.success('Revisão concluída — ficha assinada com sucesso.')
      onResolved()
    } catch {
      toast.error('Erro ao confirmar revisão. Tente novamente.')
    }
  }

  if (divergent.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma divergência encontrada. As respostas da clínica e do cliente são idênticas.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Voltar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={resolveDiff.isPending}
          >
            {resolveDiff.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Confirmar revisão
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {divergent.length} {divergent.length === 1 ? 'divergência' : 'divergências'} encontradas.
          Escolha qual resposta manter para cada campo.
        </p>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => acceptAll('clinic')}>
            Aceitar tudo da clínica
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => acceptAll('client')}>
            Aceitar tudo do cliente
          </Button>
        </div>
      </div>

      {/* Tabela desktop */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pergunta</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Resposta da clínica</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Resposta do cliente</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-40">Manter</th>
            </tr>
          </thead>
          <tbody>
            {divergent.map((entry) => {
              const choice = resolutions[entry.questionId]
              return (
                <tr key={entry.questionId} className="border-b last:border-0 bg-yellow-50 dark:bg-yellow-950/40">
                  <td className="px-3 py-2 font-medium text-foreground align-top">{entry.question}</td>
                  <td className={['px-3 py-2 align-top text-muted-foreground', choice === 'clinic' ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''].join(' ')}>
                    {entry.clinicAnswer || <span className="italic text-muted-foreground/50">Em branco</span>}
                  </td>
                  <td className={['px-3 py-2 align-top text-muted-foreground', choice === 'client' ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''].join(' ')}>
                    {entry.clientAnswer || <span className="italic text-muted-foreground/50">Em branco</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer text-[10px]">
                        <input
                          type="radio"
                          name={`diff-${entry.questionId}`}
                          checked={choice === 'clinic'}
                          onChange={() => setResolutions((p) => ({ ...p, [entry.questionId]: 'clinic' }))}
                        />
                        Clínica
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-[10px]">
                        <input
                          type="radio"
                          name={`diff-${entry.questionId}`}
                          checked={choice === 'client'}
                          onChange={() => setResolutions((p) => ({ ...p, [entry.questionId]: 'client' }))}
                        />
                        Cliente
                      </label>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden space-y-2">
        {divergent.map((entry) => {
          const choice = resolutions[entry.questionId]
          return (
            <div key={entry.questionId} className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">{entry.question}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className={['rounded border p-2 cursor-pointer text-[10px] space-y-0.5', choice === 'clinic' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'bg-card'].join(' ')}>
                  <input type="radio" name={`diff-m-${entry.questionId}`} checked={choice === 'clinic'} onChange={() => setResolutions((p) => ({ ...p, [entry.questionId]: 'clinic' }))} className="sr-only" />
                  <p className="font-medium text-muted-foreground">Clínica</p>
                  <p className="text-foreground">{entry.clinicAnswer || <span className="italic">Em branco</span>}</p>
                </label>
                <label className={['rounded border p-2 cursor-pointer text-[10px] space-y-0.5', choice === 'client' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'bg-card'].join(' ')}>
                  <input type="radio" name={`diff-m-${entry.questionId}`} checked={choice === 'client'} onChange={() => setResolutions((p) => ({ ...p, [entry.questionId]: 'client' }))} className="sr-only" />
                  <p className="font-medium text-muted-foreground">Cliente</p>
                  <p className="text-foreground">{entry.clientAnswer || <span className="italic">Em branco</span>}</p>
                </label>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleConfirm()}
          disabled={!allResolved || resolveDiff.isPending}
        >
          {resolveDiff.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Confirmar revisão
        </Button>
      </div>
    </div>
  )
}
