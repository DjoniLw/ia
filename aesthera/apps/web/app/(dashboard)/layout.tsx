'use client'

import { isAuthenticated } from '@/lib/auth'
import { useRole } from '@/lib/hooks/use-role'
import { useClinic } from '@/lib/hooks/use-settings'
import { UserNav } from '@/components/user-nav'
import {
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  Menu,
  Package,
  PackageOpen,
  Scissors,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tag,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  DoorOpen,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChatPanel } from '@/components/chat-panel'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Início', icon: Home, adminOnly: false },
  { href: '/appointments', label: 'Agendamentos', icon: CalendarDays, adminOnly: false },
  { href: '/services', label: 'Serviços', icon: Scissors, adminOnly: false },
  { href: '/professionals', label: 'Profissionais', icon: UserCheck, adminOnly: false },
  { href: '/customers', label: 'Clientes', icon: Users, adminOnly: false },
  { href: '/equipment', label: 'Equipamentos', icon: Wrench, adminOnly: false },
  { href: '/rooms', label: 'Salas', icon: DoorOpen, adminOnly: false },
  { href: '/supplies', label: 'Insumos', icon: PackageOpen, adminOnly: false },
  { href: '/compras-insumos', label: 'Compras de Insumos', icon: ShoppingBag, adminOnly: false },
  { href: '/products', label: 'Produtos', icon: Package, adminOnly: false },
  { href: '/sales', label: 'Vendas', icon: ShoppingCart, adminOnly: false },
  { href: '/billing', label: 'Cobranças', icon: CreditCard, adminOnly: true },
  { href: '/carteira', label: 'Carteira', icon: Wallet, adminOnly: false },
  { href: '/promotions', label: 'Promoções', icon: Tag, adminOnly: false },
  { href: '/packages', label: 'Pacotes', icon: Package, adminOnly: false },
  { href: '/financial', label: 'Financeiro', icon: BarChart3, adminOnly: true },
  { href: '/reports', label: 'Relatórios', icon: FileText, adminOnly: true },
  { href: '/notifications', label: 'Notificações', icon: Bell, adminOnly: false },
  { href: '/settings', label: 'Configurações', icon: Settings, adminOnly: true },
]

// Derivado de navItems — fonte única de verdade
const ADMIN_ONLY_PATHS = navItems.filter((i) => i.adminOnly).map((i) => i.href)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const role = useRole()
  const { data: clinic } = useClinic()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }
    if (role === 'staff') {
      const isRestricted = ADMIN_ONLY_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + '/'),
      )
      if (isRestricted) {
        toast.warning('Você não tem permissão para acessar esta página.')
        router.replace('/dashboard')
      }
    }
  }, [role, pathname, router])

  // Fechar sidebar ao trocar de rota (navegação mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const visibleNavItems = role === 'staff'
    ? navItems.filter((item) => !item.adminOnly)
    : navItems

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
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {visibleNavItems.map(({ href, label, icon: Icon }) => {
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

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      {/* AI Chat Panel */}
      <ChatPanel />
    </div>
  )
}
