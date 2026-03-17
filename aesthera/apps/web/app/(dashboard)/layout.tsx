'use client'

import { isAuthenticated } from '@/lib/auth'
import {
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  LogOut,
  Menu,
  Package,
  PackageOpen,
  Scissors,
  Settings,
  ShoppingCart,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearTokens, getRefreshToken } from '@/lib/auth'
import { api } from '@/lib/api'
import { ChatPanel } from '@/components/chat-panel'

const navItems = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/appointments', label: 'Agendamentos', icon: CalendarDays },
  { href: '/services', label: 'Serviços', icon: Scissors },
  { href: '/professionals', label: 'Profissionais', icon: UserCheck },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/equipment', label: 'Equipamentos', icon: Wrench },
  { href: '/supplies', label: 'Insumos', icon: PackageOpen },
  { href: '/products', label: 'Produtos', icon: Package },
  { href: '/sales', label: 'Vendas', icon: ShoppingCart },
  { href: '/billing', label: 'Cobranças', icon: CreditCard },
  { href: '/carteira', label: 'Carteira', icon: Wallet },
  { href: '/financial', label: 'Financeiro', icon: BarChart3 },
  { href: '/reports', label: 'Relatórios', icon: FileText },
  { href: '/notifications', label: 'Notificações', icon: Bell },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
    }
  }, [router])

  // Close sidebar on route change (mobile navigation)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  async function handleLogout() {
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
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b px-5">
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

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map(({ href, label, icon: Icon }) => {
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
        </nav>

        {/* Footer */}
        <div className="border-t p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-500 transition-all hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4 opacity-70" />
            Sair
          </button>
        </div>
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
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      {/* AI Chat Panel */}
      <ChatPanel />
    </div>
  )
}
