import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryItems } from '../../shared/utils/dynamo-client';
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
  const targetUserId = admin && event.queryStringParameters?.userId
    ? event.queryStringParameters.userId
    : userId;

  const { items } = await queryItems<Cert>({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${targetUserId}`,
      ':prefix': 'CERT#',
    },
  });

  return ok({ items, count: items.length });
});
