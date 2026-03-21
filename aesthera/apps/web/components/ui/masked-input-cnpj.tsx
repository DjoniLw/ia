'use client'

import { forwardRef, type FocusEventHandler } from 'react'
import { IMaskInput } from 'react-imask'
import { cn } from '@/lib/utils'

const INPUT_CLASS =
  'flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base shadow-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

interface MaskedInputCnpjProps {
  value?: string
  onChange?: (value: string) => void
  onBlur?: FocusEventHandler<HTMLInputElement>
  name?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Campo de CNPJ com máscara 00.000.000/0000-00.
 * Armazena e emite apenas dígitos (sem formatação) para compatibilidade com React Hook Form.
 */
export const MaskedInputCnpj = forwardRef<HTMLInputElement, MaskedInputCnpjProps>(
  ({ value, onChange, onBlur, name, placeholder = '00.000.000/0000-00', className, disabled }, ref) => (
    <IMaskInput
      mask="00.000.000/0000-00"
      unmask={true}
      value={value ?? ''}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputRef={ref as any}
      name={name}
      onBlur={onBlur}
      onAccept={(val: unknown) => onChange?.(val as string)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode="numeric"
      className={cn(INPUT_CLASS, className)}
    />
  ),
)
MaskedInputCnpj.displayName = 'MaskedInputCnpj'
