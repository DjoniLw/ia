import {
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  Layers,
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
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  adminOnly: boolean
  group: string
}

/**
 * Fonte única de verdade do menu lateral.
 * Ao adicionar um novo item aqui ele automaticamente:
 *  - aparece no sidebar (layout.tsx)
 *  - fica disponível no editor de permissões de staff (users-tab.tsx)
 */
export const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Início', icon: Home, adminOnly: false, group: 'Operacional' },
  { href: '/appointments', label: 'Agendamentos', icon: CalendarDays, adminOnly: false, group: 'Operacional' },
  { href: '/services', label: 'Serviços', icon: Scissors, adminOnly: false, group: 'Operacional' },
  { href: '/professionals', label: 'Profissionais', icon: UserCheck, adminOnly: false, group: 'Operacional' },
  { href: '/customers', label: 'Clientes', icon: Users, adminOnly: false, group: 'Operacional' },
  { href: '/equipment', label: 'Equipamentos', icon: Wrench, adminOnly: false, group: 'Loja & Insumos' },
  { href: '/rooms', label: 'Salas', icon: DoorOpen, adminOnly: false, group: 'Loja & Insumos' },
  { href: '/supplies', label: 'Insumos', icon: PackageOpen, adminOnly: false, group: 'Loja & Insumos' },
  { href: '/compras-insumos', label: 'Compras de Insumos', icon: ShoppingBag, adminOnly: false, group: 'Loja & Insumos' },
  { href: '/products', label: 'Produtos', icon: Package, adminOnly: false, group: 'Loja & Insumos' },
  { href: '/sales', label: 'Vendas', icon: ShoppingCart, adminOnly: false, group: 'Loja & Insumos' },
  { href: '/carteira', label: 'Carteira', icon: Wallet, adminOnly: false, group: 'Fidelização' },
  { href: '/promotions', label: 'Promoções', icon: Tag, adminOnly: false, group: 'Fidelização' },
  { href: '/packages', label: 'Pacotes', icon: Layers, adminOnly: false, group: 'Fidelização' },
  { href: '/billing', label: 'Cobranças', icon: CreditCard, adminOnly: true, group: 'Financeiro' },
  { href: '/financial', label: 'Financeiro', icon: BarChart3, adminOnly: true, group: 'Financeiro' },
  { href: '/reports', label: 'Relatórios', icon: FileText, adminOnly: true, group: 'Financeiro' },
  { href: '/notifications', label: 'Notificações', icon: Bell, adminOnly: false, group: 'Sistema' },
  { href: '/settings', label: 'Configurações', icon: Settings, adminOnly: true, group: 'Sistema' },
]

export const GROUP_ORDER = ['Operacional', 'Loja & Insumos', 'Fidelização', 'Financeiro', 'Sistema']

/** Rotas que só admin pode acessar — derivado automaticamente de navItems */
export const ADMIN_ONLY_PATHS = navItems.filter((i) => i.adminOnly).map((i) => i.href)

/**
 * Grupos para o editor de permissões de staff.
 * Derivado automaticamente de navItems — qualquer novo item do menu
 * aparece aqui sem necessidade de atualização manual.
 * Exclui /dashboard (sempre permitido) e /settings (sempre adminOnly).
 */
export const PERMISSION_GROUPS = GROUP_ORDER.map((group) => ({
  label: group,
  routes: navItems
    .filter((item) => item.group === group && item.href !== '/dashboard' && item.href !== '/settings')
    .map(({ href, label }) => ({ href, label })),
})).filter((g) => g.routes.length > 0)
