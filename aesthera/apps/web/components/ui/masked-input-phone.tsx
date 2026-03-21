'use client'

import { forwardRef, type FocusEventHandler } from 'react'
import { IMaskInput } from 'react-imask'
import { cn } from '@/lib/utils'

const INPUT_CLASS =
  'flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base shadow-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

interface MaskedInputPhoneProps {
  value?: string
  onChange?: (value: string) => void
  onBlur?: FocusEventHandler<HTMLInputElement>
  name?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

// Máscaras dinâmicas: fixo (10 dígitos) ou celular (11 dígitos)
const PHONE_MASKS = [
  { mask: '(00) 0000-0000' },
  { mask: '(00) 00000-0000' },
]

/**
 * Campo de telefone com máscara dinâmica.
 * - Fixo: (00) 0000-0000  — até 10 dígitos (DDD + 8)
 * - Celular: (00) 00000-0000 — 11 dígitos (DDD + 9)
 * A máscara muda automaticamente ao atingir 11 dígitos.
 * Armazena e emite apenas dígitos (sem formatação).
 */
export const MaskedInputPhone = forwardRef<HTMLInputElement, MaskedInputPhoneProps>(
  ({ value, onChange, onBlur, name, placeholder = '(00) 00000-0000', className, disabled }, ref) => (
    <IMaskInput
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mask={PHONE_MASKS as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch={(appended: string, dynamicMasked: any) => {
        // Seleciona pelo total de dígitos: ≤ 10 → fixo (DDD + 8 dígitos), > 10 → celular (DDD + 9 dígitos)
        const number = (String(dynamicMasked.value) + appended).replace(/\D/g, '')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return dynamicMasked.compiledMasks[number.length > 10 ? 1 : 0]
      }}
      unmask={true}
      value={value ?? ''}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputRef={ref as any}
      name={name}
      onBlur={onBlur}
      onAccept={(val) => onChange?.(val as string)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode="tel"
      className={cn(INPUT_CLASS, className)}
    />
  ),
)
MaskedInputPhone.displayName = 'MaskedInputPhone'
