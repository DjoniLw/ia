'use client'

import { isAuthenticated } from '@/lib/auth'
import { useRole } from '@/lib/hooks/use-role'
import { getUserScreenPermissions } from '@/lib/auth'
import { useClinic } from '@/lib/hooks/use-settings'
import { UserNav } from '@/components/user-nav'
import {
  Menu,
  Scissors,
  X,
} from 'lucide-react'
import { navItems, GROUP_ORDER, ADMIN_ONLY_PATHS } from '@/lib/nav-items'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ChatPanel } from '@/components/chat-panel'
import { toast } from 'sonner'

// navItems, GROUP_ORDER e ADMIN_ONLY_PATHS importados de @/lib/nav-items

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const role = useRole()
  const { data: clinic } = useClinic()

  // screenPermissions: memoized to ensure stable reference (avoids useEffect churn)
  const screenPermissions = useMemo(
    () => (typeof window !== 'undefined' ? getUserScreenPermissions() : []),
    [],
  )

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }
    if (role === 'staff') {
      if (screenPermissions.length > 0) {
        // Allowlist é autoridade principal: governa todos os paths (incluindo os adminOnly)
        const isAllowed =
          pathname === '/dashboard' ||
          pathname.startsWith('/settings/profile') ||
          screenPermissions.some((p) => pathname === p || pathname.startsWith(p + '/'))
        if (!isAllowed) {
          toast.warning('Você não tem permissão para acessar esta página.')
          router.replace('/dashboard')
        }
      } else {
        // Sem permissões granulares: bloqueia paths adminOnly, exceto /settings/profile
        const isAdminRestricted =
          ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) &&
          !pathname.startsWith('/settings/profile')
        if (isAdminRestricted) {
          toast.warning('Você não tem permissão para acessar esta página.')
          router.replace('/dashboard')
        }
      }
    }
  }, [role, pathname, router, screenPermissions])

  // Fechar sidebar ao trocar de rota (navegação mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const visibleNavItems = role === 'staff'
    ? navItems.filter((item) => {
        if (screenPermissions.length > 0) {
          // Allowlist governa: exibe dashboard + rotas explicitamente concedidas
          return item.href === '/dashboard' || screenPermissions.includes(item.href)
        }
        // Sem permissões granulares: oculta itens adminOnly
        return !item.adminOnly
      })
    : navItems

  // Verificação síncrona de autorização — evita flash de conteúdo protegido antes do useEffect
  const isScreenAllowed = useMemo(() => {
    if (!role) return true
    if (role === 'admin') return true
    if (screenPermissions.length > 0) {
      return (
        pathname === '/dashboard' ||
        pathname.startsWith('/settings/profile') ||
        screenPermissions.some((p) => pathname === p || pathname.startsWith(p + '/'))
      )
    }
    const isAdminPath =
      ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) &&
      !pathname.startsWith('/settings/profile')
    return !isAdminPath
  }, [role, pathname, screenPermissions])

  const currentPage = navItems.find((n) => n.href === pathname)

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r bg-card shadow-sm transition-transform duration-200 md:relative md:z-auto md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Brand + Clínica */}
        <div className="flex flex-col border-b px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Scissors className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">Aesthera</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto rounded-lg p-1 text-neutral-400 hover:bg-accent hover:text-accent-foreground md:hidden"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {clinic?.name && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{clinic.name}</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3">
          {GROUP_ORDER.map((group) => {
            const items = visibleNavItems.filter((item) => item.group === group)
            if (!items.length) return null
            return (
              <div key={group} className="mb-1">
                <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={[
                          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-neutral-600 hover:bg-accent hover:text-accent-foreground',
                        ].join(' ')}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? '' : 'opacity-70'}`} />
                        {label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center border-b bg-card px-4 shadow-sm md:px-6">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-3 rounded-lg p-1.5 text-neutral-500 hover:bg-accent hover:text-accent-foreground md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            {currentPage && <currentPage.icon className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground">
              {currentPage?.label ?? 'Painel'}
            </span>
          </div>

          <div className="ml-auto">
            <UserNav />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-24">{isScreenAllowed ? children : null}</main>
      </div>

      {/* AI Chat Panel */}
      <ChatPanel />
    </div>
  )
}
