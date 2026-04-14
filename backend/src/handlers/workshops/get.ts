import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem } from '../../shared/utils/dynamo-client';
import { ok, notFound } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { Workshop } from '../../shared/models/workshop.model';

/** GET /workshops/{id}  — público */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  if (!id) return notFound('Workshop');

  const workshop = await getItem<Workshop>(`WORKSHOP#${id}`, 'META');
  if (!workshop) return notFound('Workshop');

  return ok(workshop);
});
