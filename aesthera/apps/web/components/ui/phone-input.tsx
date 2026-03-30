'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// ── Países disponíveis ─────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'BR', dial: '55', flag: '🇧🇷', name: 'Brasil', mask: '(##) #####-####', digits: 11 },
  { code: 'US', dial: '1',  flag: '🇺🇸', name: 'EUA',    mask: '(###) ###-####',  digits: 10 },
  { code: 'PT', dial: '351',flag: '🇵🇹', name: 'Portugal',mask: '## ### ####',    digits: 9  },
  { code: 'AR', dial: '54', flag: '🇦🇷', name: 'Argentina',mask: '(##) ####-####',digits: 10 },
] as const

type Country = (typeof COUNTRIES)[number]

// ── Máscara ────────────────────────────────────────────────────────────────────
function applyMask(digits: string, mask: string): string {
  let di = 0
  let result = ''
  for (const ch of mask) {
    if (di >= digits.length) break
    if (ch === '#') {
      result += digits[di++]
    } else {
      result += ch
    }
  }
  return result
}

function stripMask(value: string): string {
  return value.replace(/\D/g, '')
}

// ── Validação ──────────────────────────────────────────────────────────────────
export function buildE164(dialCode: string, localDigits: string): string {
  return dialCode + localDigits
}

export function validatePhone(dialCode: string, localDigits: string, country: Country): boolean {
  return localDigits.length === country.digits
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface PhoneInputProps {
  value: string            // e164 completo: "5547999553221"
  onChange: (e164: string, isValid: boolean) => void
  id?: string
  disabled?: boolean
  className?: string
}

export function PhoneInput({ value, onChange, id, disabled, className }: PhoneInputProps) {
  const [open, setOpen] = useState(false)
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [display, setDisplay] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Ref estável para não precisar de onChange nas dependências do useEffect de montagem
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Ao receber value externo (ex: pré-preenchimento do cadastro), tenta parsear
  useEffect(() => {
    if (!value) { setDisplay(''); return }
    // Remove o código do país do início
    const digits = value.replace(/\D/g, '')
    for (const c of COUNTRIES) {
      if (digits.startsWith(c.dial)) {
        const local = digits.slice(c.dial.length)
        setCountry(c)
        setDisplay(applyMask(local, c.mask))
        // Notifica o pai com o estado inicial já parseado
        onChangeRef.current(buildE164(c.dial, local), validatePhone(c.dial, local, c))
        return
      }
    }
    // Fallback: trata como BR sem código
    const local = digits.slice(0, COUNTRIES[0].digits)
    setDisplay(applyMask(local, COUNTRIES[0].mask))
    onChangeRef.current(buildE164(COUNTRIES[0].dial, local), validatePhone(COUNTRIES[0].dial, local, COUNTRIES[0]))
  }, []) // só na montagem — o estado interno é controlado

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleInput(raw: string) {
    const digits = stripMask(raw).slice(0, country.digits)
    const masked = applyMask(digits, country.mask)
    setDisplay(masked)
    const e164 = buildE164(country.dial, digits)
    const valid = validatePhone(country.dial, digits, country)
    onChange(e164, valid)
  }

  function handleSelectCountry(c: Country) {
    setCountry(c)
    setOpen(false)
    // Re-aplica máscara do novo país com dígitos atuais
    const digits = stripMask(display).slice(0, c.digits)
    const masked = applyMask(digits, c.mask)
    setDisplay(masked)
    const e164 = buildE164(c.dial, digits)
    const valid = validatePhone(c.dial, digits, c)
    onChange(e164, valid)
  }

  return (
    <div className={['flex h-9 rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2', className].join(' ')}>
      {/* Seletor de país */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className="flex h-full items-center gap-1 px-2.5 border-r border-input text-sm focus:outline-none disabled:opacity-50"
        >
          <span>{country.flag}</span>
          <span className="text-muted-foreground text-xs font-medium">+{country.dial}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border bg-popover shadow-md py-1">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleSelectCountry(c)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                <span>{c.flag}</span>
                <span>{c.name}</span>
                <span className="ml-auto text-muted-foreground text-xs">+{c.dial}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Campo de número */}
      <input
        id={id}
        type="tel"
        disabled={disabled}
        value={display}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={country.mask.replace(/#/g, '0')}
        className="flex-1 bg-transparent px-2.5 py-1 focus:outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
    </div>
  )
}
