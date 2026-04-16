import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryItems, scanItems } from '../../shared/utils/dynamo-client';
import { ok } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { getUserId, isAdmin } from '../../shared/middleware/auth';
import { Cert } from '../../shared/models/cert.model';

/**
 * GET /certs
 * Admin → devuelve todos (via GSI1 scan simulado, mejor con GSI real o ElasticSearch).
 * Student → devuelve solo los suyos.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const userId = getUserId(event);
  const admin = isAdmin(event);
  const requestedUserId = event.queryStringParameters?.userId;

  if (admin && !requestedUserId) {
    const { items } = await scanItems<Cert>({
      FilterExpression: 'begins_with(PK, :userPrefix) AND begins_with(SK, :certPrefix)',
      ExpressionAttributeValues: {
        ':userPrefix': 'USER#',
        ':certPrefix': 'CERT#',
      },
    });

    const sorted = [...items].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    return ok({ items: sorted, count: sorted.length });
  }

  const targetUserId = admin && requestedUserId ? requestedUserId : userId;

  const { items } = await queryItems<Cert>({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${targetUserId}`,
      ':prefix': 'CERT#',
    },
  });

  const sorted = [...items].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  return ok({ items: sorted, count: sorted.length });
});
