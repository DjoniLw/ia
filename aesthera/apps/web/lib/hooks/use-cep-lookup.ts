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

  async function lookup(rawCep: string): Promise<CepAddress | null> {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return null
    if (digits === lastLookedUp.current) return null

    lastLookedUp.current = digits
    setIsLoading(true)
    setNotFound(false)

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) throw new Error('network')

      const data: ViaCepResponse = await res.json() as ViaCepResponse
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
    } catch {
      toast.error('Não foi possível buscar o CEP. Preencha manualmente.')
      lastLookedUp.current = null
      return null
    } finally {
      setIsLoading(false)
    }
  }

  function reset() {
    lastLookedUp.current = null
    setNotFound(false)
  }

  return { lookup, isLoading, notFound, reset }
}
