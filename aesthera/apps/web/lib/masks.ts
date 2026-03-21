/**
 * Utilitários de formatação para exibição de campos mascarados.
 * Aceitam tanto dígitos puros (armazenados no banco) quanto valores já
 * formatados (dados legados), retornando sempre a representação visual correta.
 * Retornam null quando o valor é nulo, undefined ou vazio.
 */

export function formatCpf(value: string | null | undefined): string | null {
  if (!value) return null
  const d = value.replace(/\D/g, '')
  if (d.length !== 11) return value || null
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function formatCnpj(value: string | null | undefined): string | null {
  if (!value) return null
  const d = value.replace(/\D/g, '')
  if (d.length !== 14) return value || null
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function formatPhone(value: string | null | undefined): string | null {
  if (!value) return null
  const d = value.replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return value || null
}

export function formatCep(value: string | null | undefined): string | null {
  if (!value) return null
  const d = value.replace(/\D/g, '')
  if (d.length !== 8) return value || null
  return `${d.slice(0, 5)}-${d.slice(5)}`
}
