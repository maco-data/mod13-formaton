import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem } from '../../shared/utils/dynamo-client';
import { ok, notFound, forbidden } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { getUserId, isAdmin } from '../../shared/middleware/auth';
import { User } from '../../shared/models/user.model';

/**
 * GET /users/{id}
 * Admin puede consultar cualquier perfil. Un usuario autenticado puede consultar el suyo.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  if (!id) return notFound('User');

  const requesterId = getUserId(event);
  if (!isAdmin(event) && requesterId !== id) return forbidden();

  const user = await getItem<User>(`USER#${id}`, 'META');
  if (!user) return notFound('User');

  return ok(user);
});
