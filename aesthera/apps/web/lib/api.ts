import axios from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './auth'

function getClinicSlug(): string {
  if (typeof window === 'undefined') return ''
  const hostname = window.location.hostname
  // e.g. "minha-clinica.localhost" or "minha-clinica.aesthera.com"
  const parts = hostname.split('.')
  if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'app' && parts[0] !== 'localhost') {
    return parts[0]
  }
  // Fallback for local development: read from localStorage
  return localStorage.getItem('clinic-slug') ?? ''
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
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
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/refresh`,
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
