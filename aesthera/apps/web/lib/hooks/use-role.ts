import { getAccessToken, decodeJwtPayload } from '@/lib/auth'

export type UserRole = 'admin' | 'staff'

export function useRole(): UserRole | null {
  if (typeof window === 'undefined') return null
  const token = getAccessToken()
  if (!token) return null
  const payload = decodeJwtPayload<{ role?: UserRole }>(token)
  return payload?.role ?? null
}
