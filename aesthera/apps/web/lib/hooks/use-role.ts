import { getUserRole, UserRole } from '@/lib/auth'

export type { UserRole }

export function useRole(): UserRole | null {
  if (typeof window === 'undefined') return null
  return getUserRole()
}
