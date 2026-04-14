import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, updateItem } from '../../shared/utils/dynamo-client';
import { noContent, notFound, conflict, badRequest } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { getUserId, isAdmin } from '../../shared/middleware/auth';
import { Workshop } from '../../shared/models/workshop.model';
import { Registration } from '../../shared/models/registration.model';

/**
 * DELETE /workshops/{id}/register  (student autenticado o admin)
 * Soft-cancel: cambia status de la inscripción a "cancelled".
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const workshopId = event.pathParameters?.id;
  if (!workshopId) return badRequest('workshopId requerido');

  const requesterId = getUserId(event);
  // Admin puede desinscribir a cualquier usuario; student solo a sí mismo
  const targetUserId = isAdmin(event) && event.queryStringParameters?.userId
    ? event.queryStringParameters.userId
    : requesterId;

  const [workshop, reg] = await Promise.all([
    getItem<Workshop>(`WORKSHOP#${workshopId}`, 'META'),
    getItem<Registration>(`WORKSHOP#${workshopId}`, `REG#USER#${targetUserId}`),
  ]);

  if (!workshop) return notFound('Workshop');
  if (!reg)      return notFound('Inscripción');
  if (reg.status === 'cancelled') return conflict('La inscripción ya está cancelada');
  if (workshop.status === 'completed') return conflict('No se puede cancelar tras la finalización del taller');

  await updateItem(`WORKSHOP#${workshopId}`, `REG#USER#${targetUserId}`, { status: 'cancelled' });
  await updateItem(`WORKSHOP#${workshopId}`, 'META', {
    enrolledCount: Math.max(0, workshop.enrolledCount - 1),
  });

  return noContent();
});
