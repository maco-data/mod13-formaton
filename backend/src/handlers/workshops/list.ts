import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryItems } from '../../shared/utils/dynamo-client';
import { ok, badRequest } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { Workshop } from '../../shared/models/workshop.model';

/**
 * GET /workshops
 * Público. Paginado con LastEvaluatedKey.
 * Query params: limit, nextToken, category, status
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const qs = event.queryStringParameters ?? {};
  const limit = Math.min(parseInt(qs.limit ?? '20', 10), 100);

  if (isNaN(limit) || limit < 1) return badRequest('Parámetro "limit" inválido');

  let lastKey: Record<string, unknown> | undefined;
  if (qs.nextToken) {
    try {
      lastKey = JSON.parse(Buffer.from(qs.nextToken, 'base64').toString('utf-8'));
    } catch {
      return badRequest('Parámetro "nextToken" inválido');
    }
  }

  // Si hay filtro de categoría → usar GSI2; si no → GSI1
  const useGSI2 = Boolean(qs.category);

  const params = useGSI2
    ? {
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `CATEGORY#${qs.category}` },
        Limit: limit,
        ...(lastKey && { ExclusiveStartKey: lastKey }),
        ScanIndexForward: true,
      }
    : {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'WORKSHOP#ALL' },
        Limit: limit,
        ...(lastKey && { ExclusiveStartKey: lastKey }),
        ScanIndexForward: true,
      };

  const { items, lastKey: newLastKey } = await queryItems<Workshop>(params);

  // Filtro adicional por status si se especifica (server-side filter)
  const filtered = qs.status ? items.filter(w => w.status === qs.status) : items;

  const nextToken = newLastKey
    ? Buffer.from(JSON.stringify(newLastKey)).toString('base64')
    : undefined;

  return ok({
    items: filtered,
    count: filtered.length,
    ...(nextToken && { nextToken }),
  });
});
