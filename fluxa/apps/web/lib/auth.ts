const ACCESS_TOKEN_KEY = 'fluxa_access_token'
const REFRESH_TOKEN_KEY = 'fluxa_refresh_token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  // Also set as cookie for middleware-based auth checks
  document.cookie = `${ACCESS_TOKEN_KEY}=${accessToken}; path=/; max-age=900`
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; max-age=0`
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}
