'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { CheckCircle, ClipboardList, Loader2, XCircle } from 'lucide-react'
import { apiBaseUrl } from '@/lib/api'
import { SignatureCanvas } from '@/components/ui/signature-canvas'

const API_URL = apiBaseUrl

interface QuestionEntry {
  id: string
  text: string
  type: 'text' | 'yesno' | 'multiple' | 'numeric' | 'date' | 'select' | 'separator'
  options?: string[]
  selectOptions?: { value: string; label: string }[]
  required: boolean
}

interface PublicAnamnesisInfo {
  id: string
  clinicName: string
  customerName: string
  mode: 'blank' | 'prefilled'
  groupName: string
  questionsSnapshot: QuestionEntry[]
  staffAnswers: Record<string, unknown> | null
  expiresAt: string
}

export default function AnamnesePage() {
  const { token } = useParams<{ token: string }>()

  const [data, setData] = useState<PublicAnamnesisInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [consentChecked, setConsentChecked] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    axios
      .get<PublicAnamnesisInfo>(`${API_URL}/public/anamnese/${token}`)
      .then((res) => {
        setData(res.data)
        // Pré-preencher com respostas do staff se existirem
        if (res.data.staffAnswers) {
          const prefilled: Record<string, string> = {}
          for (const [k, v] of Object.entries(res.data.staffAnswers)) {
            prefilled[k] = v != null ? String(v) : ''
          }
          setAnswers(prefilled)
        }
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 410) {
          setErrorMsg('Este link de anamnese expirou ou foi cancelado. Solicite um novo envio à clínica.')
        } else if (status === 409) {
          setErrorMsg('Esta anamnese já foi preenchida e assinada.')
        } else {
          setErrorMsg('Link de anamnese não encontrado ou inválido.')
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(signature: string) {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await axios.post(`${API_URL}/public/anamnese/${token}`, {
        clientAnswers: answers,
        signature,
        consentGiven: true,
      })
      setSubmitted(true)
      setShowCanvas(false)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 410) {
        setErrorMsg('Este link de anamnese expirou.')
      } else if (status === 409) {
        setErrorMsg('Esta anamnese já foi assinada.')
      } else {
        setSubmitError('Erro ao enviar a anamnese. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function toggleMultiOption(id: string, option: string) {
    const current = (answers[id] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const isSelected = current.includes(option)
    const next = isSelected ? current.filter((s) => s !== option) : [...current, option]
    setAnswer(id, next.join(', '))
  }

  const questions = (data?.questionsSnapshot ?? []).filter((q) => q.type !== 'separator')
  const requiredUnanswered = questions.filter((q) => q.required && !answers[q.id])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    )
  }

  // ── Erro / expirado ────────────────────────────────────────────────────────

  if (errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-10 shadow-xl text-center max-w-sm w-full">
          <XCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-semibold text-gray-800">{errorMsg}</p>
          <p className="text-sm text-muted-foreground">
            Entre em contato com a clínica para mais informações.
          </p>
        </div>
      </div>
    )
  }

  // ── Sucesso ────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-10 shadow-xl text-center max-w-sm w-full">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <h2 className="text-xl font-bold text-gray-800">Anamnese enviada!</h2>
          <p className="text-sm text-muted-foreground">
            Suas respostas e assinatura foram registradas com sucesso. Obrigado!
          </p>
        </div>
      </div>
    )
  }

  // ── Formulário ─────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-violet-50 to-white px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <ClipboardList className="h-4 w-4" />
            <p className="text-sm font-medium">Ficha de Anamnese</p>
          </div>
          <h1 className="text-xl font-bold">{data?.groupName}</h1>
          <p className="mt-1 text-sm opacity-75">
            {data?.clinicName} · Olá, {data?.customerName}!
          </p>
        </div>

        {/* Corpo */}
        <div className="px-6 py-6 space-y-6">

          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma pergunta disponível.
            </p>
          ) : (
            <div className="space-y-5">
              {(data?.questionsSnapshot ?? []).map((q) => {
                if (q.type === 'separator') {
                  return (
                    <div key={q.id} className="space-y-1 pt-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
                        {q.text}
                      </p>
                      <hr className="border-violet-100" />
                    </div>
                  )
                }

                return (
                  <div key={q.id} className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-800">
                      {q.text}
                      {q.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>

                    {q.type === 'yesno' && (
                      <div className="flex gap-2">
                        {['Sim', 'Não'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswer(q.id, opt)}
                            className={[
                              'rounded-full px-4 py-1.5 text-sm border transition-colors font-medium',
                              answers[q.id] === opt
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300',
                            ].join(' ')}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'multiple' && q.options && (
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt) => {
                          const selected = (answers[q.id] ?? '').split(',').map((s) => s.trim()).includes(opt)
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleMultiOption(q.id, opt)}
                              className={[
                                'rounded-full px-3 py-1 text-sm border transition-colors',
                                selected
                                  ? 'bg-violet-600 text-white border-violet-600'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300',
                              ].join(' ')}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {q.type === 'select' && q.selectOptions && (
                      <select
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                      >
                        <option value="">Selecione...</option>
                        {q.selectOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}

                    {(q.type === 'text' || q.type === 'numeric' || q.type === 'date') && (
                      <input
                        type={q.type === 'numeric' ? 'number' : q.type === 'date' ? 'date' : 'text'}
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <hr className="border-gray-100" />

          {/* Canvas de assinatura */}
          {showCanvas ? (
            <SignatureCanvas
              onConfirm={(b64) => void handleSubmit(b64)}
              onCancel={() => setShowCanvas(false)}
              isPending={submitting}
              confirmLabel="Assinar e enviar"
            />
          ) : (
            <div className="space-y-4">
              {/* Consentimento LGPD */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-violet-600"
                />
                <span className="text-sm text-muted-foreground">
                  Declaro que as informações fornecidas são verdadeiras e consinto com o uso dos
                  meus dados de saúde para finalidades clínicas, conforme a{' '}
                  <strong>LGPD (Lei 13.709/2018)</strong>.
                </span>
              </label>

              {submitError && (
                <p className="text-xs text-red-500">{submitError}</p>
              )}

              <button
                type="button"
                onClick={() => setShowCanvas(true)}
                disabled={!consentChecked || requiredUnanswered.length > 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Avançar para assinatura
              </button>

              {requiredUnanswered.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {requiredUnanswered.length === 1
                    ? '1 pergunta obrigatória não respondida.'
                    : `${requiredUnanswered.length} perguntas obrigatórias não respondidas.`}
                </p>
              )}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Link válido até{' '}
            {data?.expiresAt
              ? new Date(data.expiresAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
