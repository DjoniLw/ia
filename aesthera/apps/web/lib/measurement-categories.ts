import type { MeasurementCategory, MeasurementSheetType, MeasurementInputType } from '@/lib/hooks/use-measurement-sheets'
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
  CORPORAL:          'bg-sky-600 text-white dark:bg-sky-700',
  FACIAL:            'bg-rose-500 text-white dark:bg-rose-600',
  DERMATO_FUNCIONAL: 'bg-violet-600 text-white dark:bg-violet-700',
  NUTRICIONAL:       'bg-emerald-600 text-white dark:bg-emerald-700',
  POSTURAL:          'bg-amber-700 text-white dark:bg-amber-800',
  PERSONALIZADA:     'bg-slate-500 text-white dark:bg-slate-600',
}

export const SHEET_TYPE_BADGE_COLOR: Record<MeasurementSheetType, string> = {
  TABULAR: 'bg-violet-600 text-white dark:bg-violet-700',
  SIMPLE:  'bg-slate-500 text-white dark:bg-slate-600',
}

export const FIELD_INPUT_TYPE_BADGE_COLOR: Record<MeasurementInputType, string> = {
  INPUT: 'bg-sky-600 text-white dark:bg-sky-700',
  CHECK: 'bg-emerald-600 text-white dark:bg-emerald-700',
}
