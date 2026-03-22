import { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma/client'

/**
 * Cria uma entrada de audit log para ações críticas do sistema.
 *
 * Deve ser chamado após a conclusão bem-sucedida da ação auditada.
 * Erros ao gravar o log são silenciosos para não comprometer o fluxo principal,
 * mas são registrados no console para visibilidade operacional.
 *
 * @param params.clinicId - Tenant owner da ação
 * @param params.userId   - Usuário que executou a ação (use 'system' para ações automatizadas)
 * @param params.action   - Identificador da ação (ex: 'clinical_record.created')
 * @param params.entityId - ID da entidade afetada (opcional)
 * @param params.metadata - Dados contextuais adicionais (opcional)
 * @param params.ip       - Endereço IP da requisição (opcional)
 */
export async function createAuditLog(params: {
  clinicId: string
  userId: string
  action: string
  entityId?: string
  metadata?: Prisma.InputJsonValue
  ip?: string
}): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params })
  } catch (err) {
    console.error('[audit] Falha ao gravar audit log:', err)
  }
}
