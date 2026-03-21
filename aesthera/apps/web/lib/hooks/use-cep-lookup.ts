'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'

export interface CepAddress {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

interface ViaCepResponse extends CepAddress {
  erro?: boolean
}

export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const lastLookedUp = useRef<string | null>(null)
  const activeController = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  async function lookup(rawCep: string): Promise<CepAddress | null> {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return null
    if (digits === lastLookedUp.current) return null

    const currentRequestId = ++requestId.current
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller

    lastLookedUp.current = digits
    setIsLoading(true)
    setNotFound(false)

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('network')

      const data: ViaCepResponse = await res.json() as ViaCepResponse
      if (currentRequestId !== requestId.current || lastLookedUp.current !== digits) {
        return null
      }

      if (data.erro) {
        setNotFound(true)
        return null
      }

      return {
        logradouro: data.logradouro,
        bairro: data.bairro,
        localidade: data.localidade,
        uf: data.uf,
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null
      }

      toast.error('Não foi possível buscar o CEP. Preencha manualmente.')
      lastLookedUp.current = null
      return null
    } finally {
      if (currentRequestId === requestId.current) {
        setIsLoading(false)
        activeController.current = null
      }
    }
  }

  function reset() {
    activeController.current?.abort()
    activeController.current = null
    requestId.current += 1
    lastLookedUp.current = null
    setNotFound(false)
    setIsLoading(false)
  }

  return { lookup, isLoading, notFound, reset }
}
