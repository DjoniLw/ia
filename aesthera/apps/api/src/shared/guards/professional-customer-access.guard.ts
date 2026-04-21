import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../../database/prisma/client'
import { ForbiddenError } from '../errors/app-error'

/**
 * Guard reutilizável para acesso de profissional a dados de cliente.
 *
 * Verifica se o profissional autenticado possui ao menos um agendamento
 * elegível (confirmed, in_progress ou completed) com o cliente especificado
 * em params.customerId.
 *
 * Deve ser usado após jwtProfessionalGuard.
 * Ignorado quando role !== 'professional'.
 *
 * @example
 * app.get(
 *   '/customers/:customerId/photos',
 *   { preHandler: [jwtClinicGuard, professionalCustomerAccessGuard] },
 *   handler
 * )
 */
export async function professionalCustomerAccessGuard(
  request: FastifyRequest<{ Params: { customerId?: string } }>,
  _reply: FastifyReply,
): Promise<void> {
  // Apenas aplicar restrição para role professional
  if (request.user.role !== 'professional') return

  const customerId = request.params.customerId
  if (!customerId) throw new ForbiddenError('customerId ausente')

  const clinicId = request.clinicId
  const professionalId = request.user.sub

  const hasAppointment = await prisma.appointment.findFirst({
    where: {
      clinicId,
      customerId,
      professionalId,
      status: { in: ['confirmed', 'in_progress', 'completed'] },
    },
    select: { id: true },
  })

  if (!hasAppointment) {
    throw new ForbiddenError(
      'Você não tem atendimentos com este cliente para registrar fotos',
    )
  }
}
