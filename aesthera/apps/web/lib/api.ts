import axios from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './auth'

function getClinicSlug(): string {
  if (typeof window === 'undefined') return ''
  const hostname = window.location.hostname

  // Production: only extract subdomain when on the configured custom domain
  // e.g. NEXT_PUBLIC_BASE_DOMAIN=aesthera.com.br → "clinica.aesthera.com.br" → "clinica"
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN
  if (baseDomain && hostname !== baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, hostname.length - baseDomain.length - 1)
    if (subdomain && subdomain !== 'www' && subdomain !== 'app') return subdomain
  }

  // Local dev: extract from *.localhost (e.g. clinica.localhost:3002 → "clinica")
  if (hostname.endsWith('.localhost')) {
    const subdomain = hostname.slice(0, hostname.lastIndexOf('.localhost'))
    if (subdomain && subdomain !== 'www' && subdomain !== 'app') return subdomain
  }

  // Fallback: slug stored in localStorage at login/register.
  // Used for flat Railway/Vercel URLs (no clinic subdomain in the hostname).
  return localStorage.getItem('clinic-slug') ?? ''
}

/** Returns the API base URL with no trailing slash, safe to use in template literals. */
export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token + clinic slug on every request
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const slug = getClinicSlug()
  if (slug) {
    config.headers['X-Clinic-Slug'] = slug
  }

  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token!)
  })
  failedQueue = []
}

// Intercept 401 → try refresh → replay request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      clearTokens()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
        .catch(Promise.reject)
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${apiBaseUrl}/auth/refresh`,
        { refreshToken },
      )

      setTokens(data.accessToken, data.refreshToken)
      processQueue(null, data.accessToken)
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (err) {
      processQueue(err, null)
      clearTokens()
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)
