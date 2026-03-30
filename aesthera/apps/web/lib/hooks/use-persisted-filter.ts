'use client'

import { useState } from 'react'

/**
 * useState com persistência automática no localStorage.
 * O valor da URL (urlValue) tem prioridade sobre o localStorage.
 * Quando null é passado como urlValue, o localStorage é consultado como fallback.
 */
export function usePersistedFilter<T>(
  storageKey: string,
  urlValue: T | null,
  defaultValue: T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (urlValue !== null) return urlValue
    if (typeof window === 'undefined') return defaultValue
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) return JSON.parse(stored) as T
    } catch {}
    return defaultValue
  })

  function set(v: T) {
    setValue(v)
    try {
      localStorage.setItem(storageKey, JSON.stringify(v))
    } catch {}
  }

  return [value, set]
}
