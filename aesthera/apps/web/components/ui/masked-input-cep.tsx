'use client'

import { forwardRef } from 'react'
import { IMaskInput } from 'react-imask'
import { cn } from '@/lib/utils'

const INPUT_CLASS =
  'flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base shadow-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

interface MaskedInputCepProps {
  value?: string
  onChange?: (value: string) => void
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  name?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Campo de CEP com máscara 00000-000.
 * Armazena e emite apenas dígitos (sem formatação) para compatibilidade com React Hook Form.
 */
export const MaskedInputCep = forwardRef<HTMLInputElement, MaskedInputCepProps>(
  ({ value, onChange, onBlur, name, placeholder = '00000-000', className, disabled }, ref) => (
    <IMaskInput
      mask="00000-000"
      unmask={true}
      value={value ?? ''}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputRef={ref as any}
      name={name}
      onBlur={onBlur}
      onAccept={(val) => onChange?.(val as string)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode="numeric"
      className={cn(INPUT_CLASS, className)}
    />
  ),
)
MaskedInputCep.displayName = 'MaskedInputCep'
