import { MeasurementCategory, MeasurementSheetType } from '@prisma/client'

// ─── Field / column descriptors ─────────────────────────────────────────────

export type SimpleTemplateField =
  | string
  | {
      name: string
      inputType?: 'INPUT' | 'CHECK'
      isTextual?: boolean
      unit?: string
      subColumns?: string[]
    }

export type TabularTemplateRow =
  | string
  | { name: string; defaultValue?: string }

export type TabularTemplateColumn =
  | string
  | {
      name: string
      inputType?: 'INPUT' | 'CHECK'
      isTextual?: boolean
      defaultValue?: string
    }

// ─── Template shapes ─────────────────────────────────────────────────────────

type SimpleTemplate = {
  id: string
  name: string
  category: MeasurementCategory
  type: typeof MeasurementSheetType.SIMPLE
  fields: SimpleTemplateField[]
}

type TabularTemplate = {
  id: string
  name: string
  category: MeasurementCategory
  type: typeof MeasurementSheetType.TABULAR
  rows: TabularTemplateRow[]
  columns: TabularTemplateColumn[]
}

export type MeasurementTemplate = SimpleTemplate | TabularTemplate

// ─── Normalisers (used by the service) ───────────────────────────────────────

export function resolveSimpleField(f: SimpleTemplateField) {
  const obj = typeof f === 'string' ? { name: f } : f
  return {
    name: obj.name,
    inputType: (obj.inputType ?? 'INPUT') as 'INPUT' | 'CHECK',
    isTextual: obj.isTextual ?? false,
    unit: obj.unit ?? null,
    subColumns: obj.subColumns ?? [],
  }
}

export function resolveTabularRow(r: TabularTemplateRow) {
  if (typeof r === 'string') return { name: r, defaultValue: null }
  return { name: r.name, defaultValue: r.defaultValue ?? null }
}

export function resolveTabularColumn(c: TabularTemplateColumn) {
  const obj = typeof c === 'string' ? { name: c } : c
  return {
    name: obj.name,
    inputType: (obj.inputType ?? 'INPUT') as 'INPUT' | 'CHECK',
    isTextual: obj.isTextual ?? false,
    defaultValue: obj.defaultValue ?? null,
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export const MEASUREMENT_TEMPLATES: MeasurementTemplate[] = [

  // ── Corporal ────────────────────────────────────────────────────────────────
  {
    id: 'tpl-composicao-corporal',
    name: 'Composição Corporal',
    category: MeasurementCategory.CORPORAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Peso', '% Gordura', '% Músculo', '% Água', '% Osso', 'Altura', 'IMC'],
  },
  {
    id: 'tpl-avaliacao-corporal-estetica',
    name: 'Avaliação Corporal Estética',
    category: MeasurementCategory.CORPORAL,
    type: MeasurementSheetType.TABULAR,
    rows: ['Braços', 'Costas', 'Axilares', 'Flancos', 'Abdome', 'Glúteos', 'Culotes', 'Anterior Coxas'],
    columns: [
      { name: 'FEG I',                       inputType: 'CHECK' },
      { name: 'FEG II',                      inputType: 'CHECK' },
      { name: 'FEG III',                     inputType: 'CHECK' },
      { name: 'Adiposidade',                 inputType: 'CHECK' },
      { name: 'Dura/Mole',                   inputType: 'CHECK' },
      { name: 'Flacidez Muscular/Tissular',  inputType: 'CHECK' },
      { name: 'Estrias (Brancas/Vermelhas)', inputType: 'CHECK' },
      { name: 'Varicose',                    inputType: 'CHECK' },
    ],
  },
  {
    id: 'tpl-perimetria',
    name: 'Perimetria',
    category: MeasurementCategory.CORPORAL,
    type: MeasurementSheetType.TABULAR,
    columns: [
      { name: 'Posição',     inputType: 'INPUT', isTextual: true  },
      { name: 'Medida (cm)', inputType: 'INPUT', isTextual: false },
    ],
    rows: [
      { name: 'Abdome 1', defaultValue: '00 cm acima umbigo' },
      { name: 'Abdome 2', defaultValue: '00 cm acima umbigo' },
      { name: 'Abdome 3', defaultValue: '00 cm acima umbigo' },
      { name: 'Abdome 4', defaultValue: '00 cm acima umbigo' },
      { name: 'Abdome 5', defaultValue: '00 cm abaixo umbigo' },
      { name: 'Abdome 6', defaultValue: '00 cm abaixo umbigo' },
      { name: 'Abdome 7', defaultValue: '00 cm abaixo umbigo' },
      { name: 'Abdome 8', defaultValue: '00 cm abaixo umbigo' },
      'Umbigo',
      'Cintura',
      'Quadril',
      'Tórax',
      'Braço Relaxado D',
      'Braço Relaxado E',
      'Braço Contraído D',
      'Braço Contraído E',
      'Antebraço D',
      'Antebraço E',
      { name: 'Coxa 1 D', defaultValue: '00 cm abaixo EIAS' },
      { name: 'Coxa 1 E', defaultValue: '00 cm abaixo EIAS' },
      { name: 'Coxa 2 D', defaultValue: '00 cm abaixo EIAS' },
      { name: 'Coxa 2 E', defaultValue: '00 cm abaixo EIAS' },
      'Joelho D',
      'Joelho E',
      { name: 'Braço 1 D', defaultValue: '00 cm abaixo acrômio' },
      { name: 'Braço 1 E', defaultValue: '00 cm abaixo acrômio' },
      { name: 'Braço 2 D', defaultValue: '00 cm abaixo acrômio' },
      { name: 'Braço 2 E', defaultValue: '00 cm abaixo acrômio' },
    ],
  },
  {
    id: 'tpl-plicometria',
    name: 'Plicometria',
    category: MeasurementCategory.CORPORAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Tríceps', 'Subescapular', 'Bíceps', 'Axilar média', 'Supra-ilíaca', 'Peitoral', 'Abdominal'],
  },
  {
    id: 'tpl-bioimpedancia',
    name: 'Bioimpedância',
    category: MeasurementCategory.CORPORAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Peso', 'Altura', '% Gordura', 'Massa Muscular', 'Massa Óssea', 'Água Corporal'],
  },

  // ── Dermato-funcional ───────────────────────────────────────────────────────
  {
    id: 'tpl-condicao-estetica',
    name: 'Condição Estética',
    category: MeasurementCategory.DERMATO_FUNCIONAL,
    type: MeasurementSheetType.TABULAR,
    rows: ['Braços', 'Costas', 'Axilares', 'Flancos', 'Abdome', 'Glúteos', 'Culotes'],
    columns: ['FEG I', 'FEG II', 'FEG III', 'Adiposidade', 'Dura/Mole', 'Flacidez Muscular/Tissular', 'Estrias Brancas', 'Estrias Vermelhas', 'Varicose'],
  },
  {
    id: 'tpl-firmeza-tissular',
    name: 'Firmeza Tissular',
    category: MeasurementCategory.DERMATO_FUNCIONAL,
    type: MeasurementSheetType.TABULAR,
    rows: ['Braços', 'Abdome', 'Flancos', 'Glúteos', 'Coxas'],
    columns: ['Grau 1', 'Grau 2', 'Grau 3', 'Grau 4'],
  },

  // ── Facial ───────────────────────────────────────────────────────────────────
  {
    id: 'tpl-avaliacao-facial',
    name: 'Avaliação Facial',
    category: MeasurementCategory.FACIAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Fototipo Fitzpatrick', 'Tipo de Pele', 'Oleosidade', 'Sensibilidade', 'Manchas', 'Rugas'],
  },

  // ── Postural ─────────────────────────────────────────────────────────────────
  {
    id: 'tpl-postural',
    name: 'Avaliação Postural',
    category: MeasurementCategory.POSTURAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Joelhos (valgo/varo)', 'Coluna', 'Ombros', 'Quadril', 'Pelve'],
  },
]
