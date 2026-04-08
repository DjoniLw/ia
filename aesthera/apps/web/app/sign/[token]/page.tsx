'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { CheckCircle, FileText, Loader2, PenLine, XCircle } from 'lucide-react'
import { apiBaseUrl } from '@/lib/api'
import { SignatureCanvas } from '@/components/ui/signature-canvas'

const API_URL = apiBaseUrl

interface PublicContractInfo {
  contractId: string
  contractName: string
  customerName: string
  fileUrl: string | null
  expiresAt: string
}

// ──── Página Principal ─────────────────────────────────────────────────────────

export default function SignPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicContractInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)

  useEffect(() => {
    axios
      .get<PublicContractInfo>(`${API_URL}/public/sign/${token}`)
      .then((res) => setData(res.data))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 410) {
          setErrorMsg('Este link de assinatura expirou.')
        } else if (status === 409) {
          setErrorMsg('Este contrato já foi assinado.')
        } else {
          setErrorMsg('Link de assinatura não encontrado ou inválido.')
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  async function handleSign(base64: string) {
    setSigning(true)
    try {
      await axios.post(`${API_URL}/public/sign/${token}`, { signature: base64 })
      setSigned(true)
      setShowCanvas(false)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 410) {
        setErrorMsg('Este link de assinatura expirou.')
      } else if (status === 409) {
        setErrorMsg('Este contrato já foi assinado.')
      } else {
        setErrorMsg('Erro ao registrar assinatura. Tente novamente.')
      }
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    )
  }

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

  if (signed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-10 shadow-xl text-center max-w-sm w-full">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <h2 className="text-xl font-bold text-gray-800">Contrato assinado!</h2>
          <p className="text-sm text-muted-foreground">
            Sua assinatura foi registrada com sucesso. Obrigado!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-white px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-5 text-white">
          <p className="text-sm font-medium opacity-80">Assinatura de contrato</p>
          <h1 className="mt-1 text-xl font-bold">{data?.contractName}</h1>
          <p className="mt-1 text-sm opacity-75">Olá, {data?.customerName}!</p>
        </div>

        {/* Corpo */}
        <div className="px-6 py-6 space-y-5">
          <p className="text-sm text-muted-foreground">
            Leia o contrato abaixo e, se concordar com os termos, assine no campo indicado.
          </p>

          {/* Link para visualizar o documento */}
          {data?.fileUrl && (
            <a
              href={data.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 hover:bg-violet-100 transition-colors"
            >
              <FileText className="h-4 w-4 shrink-0" />
              Abrir e ler o documento
            </a>
          )}

          <hr className="border-gray-100" />

          {/* Área de assinatura */}
          {showCanvas ? (
            <SignatureCanvas
              onConfirm={(b64) => void handleSign(b64)}
              onCancel={() => setShowCanvas(false)}
              isPending={signing}
            />
          ) : (
            <div className="space-y-3">
              {data?.fileUrl && (
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded accent-violet-600"
                  />
                  <span className="text-sm text-muted-foreground">
                    Li e concordo com os termos do{' '}
                    <a
                      href={data.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-violet-600"
                    >
                      contrato
                    </a>
                    .
                  </span>
                </label>
              )}
              <button
                type="button"
                onClick={() => setShowCanvas(true)}
                disabled={!!data?.fileUrl && !consentChecked}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PenLine className="h-4 w-4" />
                Assinar contrato
              </button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Link válido até {data?.expiresAt ? new Date(data.expiresAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }) : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
