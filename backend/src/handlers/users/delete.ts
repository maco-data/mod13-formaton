import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, updateItem } from '../../shared/utils/dynamo-client';
import { noContent, notFound, conflict } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { User } from '../../shared/models/user.model';

/**
 * DELETE /users/{id}
 * Soft delete: marca active=false para preservar histórico.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  const id = event.pathParameters?.id;
  if (!id) return notFound('User');

  const user = await getItem<User>(`USER#${id}`, 'META');
  if (!user) return notFound('User');
  if (!user.active) return conflict('El participante ya está inactivo');

  await updateItem(`USER#${id}`, 'META', { active: false });
  return noContent();
});
