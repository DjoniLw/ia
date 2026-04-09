/** Re-exporta a fonte canônica de labels de status de anamnese para evitar duplicação */
export { ANAMNESIS_STATUS_LABEL as ANAMNESIS_STATUS_LABELS } from './status-colors'

/** Labels das ações disponíveis no ciclo de vida da anamnese */
export const ANAMNESIS_ACTION_LABELS: Record<string, string> = {
  finalize: 'Finalizar rascunho',
  send: 'Enviar ao cliente',
  resend: 'Reenviar link',
  cancel: 'Cancelar',
  resolve_diff: 'Revisar respostas',
  view: 'Ver detalhes',
}
