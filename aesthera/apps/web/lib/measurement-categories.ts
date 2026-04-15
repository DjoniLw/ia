import type { MeasurementCategory, MeasurementSheetType } from '@/lib/hooks/use-measurement-sheets'
import {
  Dumbbell,
  Sparkles,
  Activity,
  Apple,
  ArrowUpDown,
  Star,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_LABELS: Record<MeasurementCategory, string> = {
  CORPORAL: 'Corporal',
  FACIAL: 'Facial',
  DERMATO_FUNCIONAL: 'Dermato-funcional',
  NUTRICIONAL: 'Nutricional',
  POSTURAL: 'Postural',
  PERSONALIZADA: 'Personalizada',
}

export const SHEET_TYPE_LABELS: Record<MeasurementSheetType, string> = {
  SIMPLE: 'Lista',
  TABULAR: 'Tabela',
}

export const MEASUREMENT_CATEGORIES_ORDER: MeasurementCategory[] = [
  'CORPORAL',
  'FACIAL',
  'DERMATO_FUNCIONAL',
  'NUTRICIONAL',
  'POSTURAL',
  'PERSONALIZADA',
]

export const CATEGORY_ICON: Record<MeasurementCategory, LucideIcon> = {
  CORPORAL: Dumbbell,
  FACIAL: Sparkles,
  DERMATO_FUNCIONAL: Activity,
  NUTRICIONAL: Apple,
  POSTURAL: ArrowUpDown,
  PERSONALIZADA: Star,
}

export const CATEGORY_BADGE_COLOR: Record<MeasurementCategory, string> = {
  CORPORAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FACIAL: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  DERMATO_FUNCIONAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  NUTRICIONAL: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POSTURAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PERSONALIZADA: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}
