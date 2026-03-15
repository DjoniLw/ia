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
  Package,
  PackageOpen,
  Scissors,
  Settings,
  ShoppingCart,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
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
  { href: '/financial', label: 'Financeiro', icon: BarChart3 },
  { href: '/reports', label: 'Relatórios', icon: FileText },
  { href: '/notifications', label: 'Notificações', icon: Bell },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
    }
  }, [router])

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
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-card shadow-sm">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Scissors className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">Aesthera</span>
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
        <header className="flex h-14 items-center border-b bg-card px-6 shadow-sm">
          <div className="flex items-center gap-2">
            {currentPage && <currentPage.icon className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground">
              {currentPage?.label ?? 'Painel'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {/* AI Chat Panel */}
      <ChatPanel />
    </div>
  )
}
