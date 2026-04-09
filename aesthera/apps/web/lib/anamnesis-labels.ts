/** Labels de status de anamnese para exibição na interface */
export const ANAMNESIS_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  clinic_filled: 'Preenchida pela clínica',
  sent_to_client: 'Enviada ao cliente',
  client_submitted: 'Aguardando revisão',
  pending: 'Pendente',
  signed: 'Assinada',
  expired: 'Expirada',
  correction_requested: 'Correção solicitada',
  cancelled: 'Cancelada',
}

/** Labels das ações disponíveis no ciclo de vida da anamnese */
export const ANAMNESIS_ACTION_LABELS: Record<string, string> = {
  finalize: 'Finalizar rascunho',
  send: 'Enviar ao cliente',
  resend: 'Reenviar link',
  cancel: 'Cancelar',
  resolve_diff: 'Revisar respostas',
  view: 'Ver detalhes',
}
