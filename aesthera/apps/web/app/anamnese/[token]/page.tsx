'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { CheckCircle, ClipboardList, Loader2, XCircle } from 'lucide-react'
import { apiBaseUrl } from '@/lib/api'
import { SignatureCanvas } from '@/components/ui/signature-canvas'
import { Button } from '@/components/ui/button'

const API_URL = apiBaseUrl

interface QuestionEntry {
  id: string
  text: string
  type: 'text' | 'yesno' | 'multiple' | 'numeric' | 'date' | 'select' | 'separator'
  options?: string[]
  optionImages?: (string | null)[]
  selectOptions?: { label: string; withDescription?: boolean; imageUrl?: string }[]
  required: boolean
  imageUrl?: string
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
  consentText?: string
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
  const [currentStep, setCurrentStep] = useState(0)
  const [triedAdvance, setTriedAdvance] = useState(false)

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
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        if (status === 410) {
          if (message?.includes('cancelado')) {
            setErrorMsg('Este link de anamnese foi cancelado. Entre em contato com a clínica.')
          } else {
            setErrorMsg('Este link expirou. Entre em contato com a clínica para receber um novo link.')
          }
        } else if (status === 409) {
          setErrorMsg('Esta ficha já foi preenchida e assinada. Obrigado!')
        } else if (status === 404) {
          setErrorMsg('Link de anamnese inválido ou não encontrado.')
        } else {
          setErrorMsg('Não foi possível carregar a ficha. Tente novamente mais tarde.')
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
        signatureBase64: signature,
        consentGiven: true,
        // ⛔ consentText: NUNCA enviado do cliente — SEC1/RN17 — gerado server-side
      })
      setSubmitted(true)
      setShowCanvas(false)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 410) {
        if (message?.includes('cancelado')) {
          setErrorMsg('Este link de anamnese foi cancelado. Entre em contato com a clínica.')
        } else {
          setErrorMsg('Este link expirou. Entre em contato com a clínica para receber um novo link.')
        }
      } else if (status === 409) {
        setErrorMsg('Esta ficha já foi preenchida e assinada. Obrigado!')
      } else if (status === 422) {
        setSubmitError(message ?? 'Dados inválidos. Verifique suas respostas e tente novamente.')
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

  function handleNext() {
    if (currentRequiredEmpty.length > 0) {
      setTriedAdvance(true)
      return
    }
    setCurrentStep((prev) => prev + 1)
    setTriedAdvance(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isPrefilled = data?.mode === 'prefilled'
  const allQs = data?.questionsSnapshot ?? []
  const allNonSepQs = allQs.filter((q) => q.type !== 'separator')
  const requiredUnanswered = allNonSepQs.filter((q) => q.required && !answers[q.id])
  const stepsData = (() => {
    const result: Array<{ title?: string; questions: QuestionEntry[] }> = []
    let cur: { title?: string; questions: QuestionEntry[] } = { questions: [] }
    for (const q of allQs) {
      if (q.type === 'separator') {
        if (cur.questions.length > 0) result.push(cur)
        cur = { title: q.text, questions: [] }
      } else {
        cur.questions.push(q)
      }
    }
    if (cur.questions.length > 0 || cur.title) result.push(cur)
    return result.length > 0 ? result : [{ questions: [] }]
  })()
  const totalSteps = stepsData.length
  const currentStepData = stepsData[currentStep] ?? { questions: [] }
  const currentStepQs = currentStepData.questions
  const currentRequiredEmpty = currentStepQs.filter((q) => q.required && !answers[q.id])
  const isLastStep = currentStep === totalSteps - 1

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="flex min-h-screen flex-col items-center justify-start bg-muted/20 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-primary px-6 py-5 text-primary-foreground">
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

          {isPrefilled && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              A clínica preencheu esta ficha com antecedência. Revise as informações abaixo e assine para confirmar.
            </div>
          )}

          {/* Progresso de etapas */}
          {totalSteps > 1 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Etapa {currentStep + 1} de {totalSteps}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(((currentStep + 1) / totalSteps) * 100)}%
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          )}

          {currentStepData.title && (
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                {currentStepData.title}
              </p>
              <hr className="border-border" />
            </div>
          )}

          {currentStepQs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma pergunta disponível.
            </p>
          ) : (
            <div className="space-y-5">
              {currentStepQs.map((q) => {
                const hasError = triedAdvance && q.required && !answers[q.id]
                return (
                  <div key={q.id} className="space-y-1.5">
                    {q.imageUrl && (
                      <img src={q.imageUrl} alt="" className="rounded-xl object-cover max-h-48 w-full mb-1" />
                    )}
                    <label className={['block text-sm font-medium', hasError ? 'text-red-600' : 'text-gray-800'].join(' ')}>
                      {q.text}
                      {q.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>

                    <>
                    {q.type === 'yesno' && (
                      <div className={['flex gap-2', hasError ? 'rounded-xl ring-1 ring-red-500 p-1' : ''].join(' ')}>
                        {['Sim', 'Não'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswer(q.id, opt)}
                            className={[
                              'rounded-full px-4 py-1.5 text-sm border transition-colors font-medium',
                              answers[q.id] === opt
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50',
                            ].join(' ')}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'multiple' && q.options && (
                      <div className={['flex flex-wrap gap-2', hasError ? 'rounded-xl ring-1 ring-red-500 p-1' : ''].join(' ')}>
                        {q.options.map((opt, idx) => {
                          const selected = (answers[q.id] ?? '').split(',').map((s) => s.trim()).includes(opt)
                          const img = (q.optionImages ?? [])[idx]
                          return (
                            // eslint-disable-next-line aesthera/no-native-button
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleMultiOption(q.id, opt)}
                              className={[
                                'flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-sm border transition-colors',
                                selected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50',
                              ].join(' ')}
                            >
                              {img && <img src={img} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {q.type === 'select' && q.selectOptions && (
                      <div className={['space-y-2', hasError ? 'rounded-xl ring-1 ring-red-500 p-1' : ''].join(' ')}>
                        {q.selectOptions.map((opt) => (
                          <div key={opt.label} className="space-y-1">
                            {/* eslint-disable-next-line aesthera/no-native-button */}
                            <button
                              type="button"
                              onClick={() => {
                                setAnswer(q.id, answers[q.id] === opt.label ? '' : opt.label)
                                if (!opt.withDescription) setAnswer(q.id + '__desc', '')
                              }}
                              className={[
                                'flex items-center gap-3 w-full rounded-xl px-3 py-2 text-sm border transition-colors text-left',
                                answers[q.id] === opt.label
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50',
                              ].join(' ')}
                            >
                              {opt.imageUrl && <img src={opt.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />}
                              <span>{opt.label}</span>
                            </button>
                            {opt.withDescription && answers[q.id] === opt.label && (
                              <textarea
                                value={answers[q.id + '__desc'] ?? ''}
                                onChange={(e) => setAnswer(q.id + '__desc', e.target.value)}
                                rows={2}
                                placeholder="Descreva..."
                                className="ml-4 w-[calc(100%-1rem)] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm resize-none focus:border-primary focus:outline-none"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {(q.type === 'text' || q.type === 'numeric' || q.type === 'date') && (
                      <input
                        type={q.type === 'numeric' ? 'number' : q.type === 'date' ? 'date' : 'text'}
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        className={['w-full rounded-xl border px-3 py-2 text-sm focus:outline-none', hasError ? 'border-red-500 focus:border-red-500' : 'border-gray-200 bg-white focus:border-primary'].join(' ')}
                      />
                    )}
                    </>
                    {hasError && (
                      <p className="text-xs text-red-500">Campo obrigatório.</p>
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
              onConfirm={(b64) => {
                // CA16: validar tamanho máximo da assinatura (3 MB ≈ 4,2 MB em base64)
                if (b64.length > 4_200_000) {
                  setSubmitError('A assinatura excede o tamanho máximo permitido (3 MB). Tente novamente com um traço mais simples.')
                  return
                }
                void handleSubmit(b64)
              }}
              onCancel={() => setShowCanvas(false)}
              isPending={submitting}
              confirmLabel="Assinar e enviar"
            />
          ) : isLastStep ? (
            <div className="space-y-4">
              {/* Consentimento LGPD */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  {data?.consentText ?? (
                    <>
                      Declaro que as informações fornecidas são verdadeiras e consinto com o uso dos
                      meus dados de saúde para finalidades clínicas, conforme a{' '}
                      <strong>LGPD (Lei 13.709/2018)</strong>.
                    </>
                  )}
                </span>
              </label>

              {submitError && (
                <p className="text-xs text-red-500">{submitError}</p>
              )}

              <div className="flex gap-3">
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setCurrentStep((prev) => prev - 1); setTriedAdvance(false) }}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold"
                  >
                    Anterior
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    if (currentRequiredEmpty.length > 0) { setTriedAdvance(true); return }
                    setShowCanvas(true)
                  }}
                  disabled={!consentChecked || requiredUnanswered.length > 0}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold"
                >
                  Avançar para assinatura
                </Button>
              </div>

              {requiredUnanswered.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {requiredUnanswered.length === 1
                    ? '1 pergunta obrigatória não respondida.'
                    : `${requiredUnanswered.length} perguntas obrigatórias não respondidas.`}
                </p>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setCurrentStep((prev) => prev - 1); setTriedAdvance(false) }}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold"
                >
                  Anterior
                </Button>
              )}
              <Button
                type="button"
                onClick={handleNext}
                className="flex-1 rounded-xl py-3 text-sm font-semibold"
              >
                Próximo
              </Button>
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
