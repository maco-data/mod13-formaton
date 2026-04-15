import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { scanItems } from '../../shared/utils/dynamo-client';
import { ok } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { User } from '../../shared/models/user.model';

/**
 * GET /users
 * Devuelve los perfiles creados en la plataforma.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  const { items } = await scanItems<User>({
    FilterExpression: 'begins_with(PK, :userPrefix) AND SK = :meta',
    ExpressionAttributeValues: {
      ':userPrefix': 'USER#',
      ':meta': 'META',
    },
  });

  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return ok({ items: sorted, count: sorted.length });
});
