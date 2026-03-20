/**
 * Dados da empresa fornecedora do software (Aesthera).
 * Usados em mensagens de suporte, e-mails e notificações ao cliente final.
 * Preencha os campos antes de ir para produção.
 */
export const companyConfig = {
  name: 'Aesthera',
  supportEmail: '', // Ex: 'suporte@aesthera.com.br'
  supportPhone: '', // Ex: '(11) 9xxxx-xxxx'
  supportWhatsapp: '', // Somente dígitos para link wa.me — Ex: '5511911112222'
  website: '', // Ex: 'https://aesthera.com.br'
} as const
