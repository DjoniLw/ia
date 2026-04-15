import { MeasurementCategory, MeasurementSheetType } from '@prisma/client'

type SimpleTemplate = {
  id: string
  name: string
  category: MeasurementCategory
  type: typeof MeasurementSheetType.SIMPLE
  fields: string[]
}

type TabularTemplate = {
  id: string
  name: string
  category: MeasurementCategory
  type: typeof MeasurementSheetType.TABULAR
  rows: string[]
  columns: string[]
}

export type MeasurementTemplate = SimpleTemplate | TabularTemplate

export const MEASUREMENT_TEMPLATES: MeasurementTemplate[] = [
  {
    id: 'tpl-perimetria',
    name: 'Perimetria',
    category: MeasurementCategory.CORPORAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Cintura', 'Abdome', 'Quadril', 'Braço D', 'Braço E', 'Coxa D', 'Coxa E'],
  },
  {
    id: 'tpl-bioimpedancia',
    name: 'Bioimpedância',
    category: MeasurementCategory.CORPORAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Peso', 'Altura', '% Gordura', 'Massa Muscular', 'Massa Óssea', 'Água Corporal'],
  },
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
  {
    id: 'tpl-avaliacao-facial',
    name: 'Avaliação Facial',
    category: MeasurementCategory.FACIAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Fototipo Fitzpatrick', 'Tipo de Pele', 'Oleosidade', 'Sensibilidade', 'Manchas', 'Rugas'],
  },
  {
    id: 'tpl-postural',
    name: 'Avaliação Postural',
    category: MeasurementCategory.POSTURAL,
    type: MeasurementSheetType.SIMPLE,
    fields: ['Joelhos (valgo/varo)', 'Coluna', 'Ombros', 'Quadril', 'Pelve'],
  },
]
