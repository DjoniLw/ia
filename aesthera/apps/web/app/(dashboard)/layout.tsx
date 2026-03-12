'use client'

import { isAuthenticated } from '@/lib/auth'
import { CalendarDays, CreditCard, Home, LayoutDashboard, LogOut, Scissors, Settings, UserCheck, Users, BarChart3, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { clearTokens } from '@/lib/auth'
import { ChatPanel } from '@/components/chat-panel'

const navItems = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/appointments', label: 'Agendamentos', icon: CalendarDays },
  { href: '/services', label: 'Serviços', icon: Scissors },
  { href: '/professionals', label: 'Profissionais', icon: UserCheck },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/billing', label: 'Cobranças', icon: CreditCard },
  { href: '/financial', label: 'Financeiro', icon: BarChart3 },
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

  function handleLogout() {
    clearTokens()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-card">
        <div className="flex h-16 items-center border-b px-6">
          <LayoutDashboard className="mr-2 h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Aesthera</span>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center border-b bg-card px-6">
          <h1 className="text-sm font-medium text-muted-foreground">
            {navItems.find((n) => n.href === pathname)?.label ?? 'Painel'}
          </h1>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {/* AI Chat Panel */}
      <ChatPanel />
    </div>
  )
}
