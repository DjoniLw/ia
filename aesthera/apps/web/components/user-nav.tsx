'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { clearTokens, getRefreshToken } from '@/lib/auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { LogOut, User } from 'lucide-react'

interface UserMe {
  id: string
  name: string
  email: string
  role: 'admin' | 'staff'
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  staff: 'Recepcionista',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

export function UserNav() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: user } = useQuery<UserMe>({
    queryKey: ['users', 'me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  async function handleLogout() {
    setOpen(false)
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      await Promise.race([
        api.post('/auth/logout', { refreshToken }).catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ])
    }
    clearTokens()
    router.push('/login')
  }

  const initials = user ? getInitials(user.name) : '?'
  const roleLabel = user ? (ROLE_LABEL[user.role] ?? user.role) : ''

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-accent"
        aria-label="Menu do usuário"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground select-none">
          {initials}
        </div>
        {user && (
          <div className="hidden text-left md:block">
            <p className="text-xs font-semibold leading-tight text-foreground">{user.name}</p>
            <p className="text-xs leading-tight text-muted-foreground">{roleLabel}</p>
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border bg-card shadow-lg">
          <div className="border-b px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">{user?.name ?? '...'}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <div className="p-1">
            <Link
              href="/settings/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <User className="h-3.5 w-3.5 opacity-70" />
              Meu perfil
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5 opacity-70" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
