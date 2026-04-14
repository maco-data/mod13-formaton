import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryItems } from '../../shared/utils/dynamo-client';
import { ok, notFound, badRequest } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { Registration } from '../../shared/models/registration.model';

/** GET /workshops/{id}/registrations  (admin) */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  const workshopId = event.pathParameters?.id;
  if (!workshopId) return badRequest('workshopId requerido');

  const { items } = await queryItems<Registration>({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `WORKSHOP#${workshopId}`,
      ':prefix': 'REG#USER#',
    },
  });

  if (items.length === 0) {
    // Verificar si el workshop existe
    const exists = await import('../../shared/utils/dynamo-client').then(m => m.getItem(`WORKSHOP#${workshopId}`, 'META'));
    if (!exists) return notFound('Workshop');
  }

  return ok({ items, count: items.length });
});
