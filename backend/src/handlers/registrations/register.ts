import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, putItem, updateItem } from '../../shared/utils/dynamo-client';
import { ok, created, notFound, conflict, badRequest, forbidden } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { getClaims, getUserId } from '../../shared/middleware/auth';
import { Workshop } from '../../shared/models/workshop.model';
import { Registration } from '../../shared/models/registration.model';
import { publishStudentRegistered } from '../../events/student-registered';

/**
 * POST /workshops/{id}/register  (student autenticado)
 * Idempotente: si ya existe la inscripción, devuelve 200 en lugar de 409.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const workshopId = event.pathParameters?.id;
  if (!workshopId) return badRequest('workshopId requerido');

  const userId = getUserId(event);
  const claims = getClaims(event);

  const workshop = await getItem<Workshop>(`WORKSHOP#${workshopId}`, 'META');
  if (!workshop) return notFound('Workshop');
  if (workshop.status === 'cancelled')  return forbidden();
  if (workshop.status === 'completed')  return conflict('El taller ya ha finalizado');
  if (workshop.enrolledCount >= workshop.capacity) return conflict('El taller está completo (lista de espera no implementada)');

  // Idempotencia: comprobar si ya existe
  const existing = await getItem<Registration>(`WORKSHOP#${workshopId}`, `REG#USER#${userId}`);
  if (existing && existing.status === 'confirmed') {
    return ok(existing);
  }

  const now = new Date().toISOString();
  const registration: Registration = {
    PK: `WORKSHOP#${workshopId}`,
    SK: `REG#USER#${userId}`,
    workshopId,
    userId,
    status: 'confirmed',
    registeredAt: now,
    GSI1PK: `USER#${userId}`,
    GSI1SK: `REG#${workshopId}`,
  };

  await putItem(registration);
  await updateItem(`WORKSHOP#${workshopId}`, 'META', { enrolledCount: workshop.enrolledCount + 1 });
  await publishStudentRegistered({
    registration,
    workshop,
    user: {
      id: userId,
      email: claims.email,
      givenName: claims.given_name,
      familyName: claims.family_name,
    },
  });

  return created(registration);
});
