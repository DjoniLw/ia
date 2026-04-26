const ACCESS_TOKEN_KEY = 'aesthera_access_token'
const REFRESH_TOKEN_KEY = 'aesthera_refresh_token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function setTokensSession(accessToken: string, refreshToken: string): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

/** Persiste os novos tokens no mesmo storage onde o refresh token atual está armazenado. */
export function setTokensAuto(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(REFRESH_TOKEN_KEY)) {
    setTokens(accessToken, refreshToken)
  } else {
    setTokensSession(accessToken, refreshToken)
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}

export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    let base64 = token.split('.')[1]
    if (!base64) return null

    // Normaliza Base64URL para Base64 padrão e adiciona padding
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4 !== 0) {
      base64 += '='
    }

    const binary = atob(base64)

    // Garante decodificação correta em UTF-8
    let json: string
    if (typeof TextDecoder !== 'undefined') {
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      json = new TextDecoder('utf-8').decode(bytes)
    } else {
      json = decodeURIComponent(escape(binary))
    }

    return JSON.parse(json) as T
  } catch {
    return null
  }
}

export type UserRole = 'admin' | 'staff' | 'professional'

export function getUserRole(): UserRole | null {
  const token = getAccessToken()
  if (!token) return null
  const payload = decodeJwtPayload<{ role?: UserRole }>(token)
  return payload?.role ?? null
}

export function getUserScreenPermissions(): string[] {
  const token = getAccessToken()
  if (!token) return []
  const payload = decodeJwtPayload<{ screenPermissions?: unknown }>(token)
  if (!Array.isArray(payload?.screenPermissions)) return []
  return payload.screenPermissions.filter((p): p is string => typeof p === 'string')
}
