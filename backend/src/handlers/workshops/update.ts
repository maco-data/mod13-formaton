import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, updateItem } from '../../shared/utils/dynamo-client';
import { ok, notFound, badRequest } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { UpdateWorkshopInput } from '../../shared/models/workshop.model';

const IMMUTABLE = ['id', 'PK', 'SK', 'enrolledCount', 'createdAt', 'GSI1PK'];

/** PUT /workshops/{id}  (admin) */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  const id = event.pathParameters?.id;
  if (!id) return notFound('Workshop');
  if (!event.body) return badRequest('Body requerido');

  const existing = await getItem(`WORKSHOP#${id}`, 'META');
  if (!existing) return notFound('Workshop');

  let updates: UpdateWorkshopInput;
  try { updates = JSON.parse(event.body); } catch { return badRequest('JSON inválido'); }

  // Eliminar campos inmutables
  IMMUTABLE.forEach(k => delete (updates as Record<string, unknown>)[k]);

  // Recalcular GSI keys si cambian startAt o category
  const payload: Record<string, unknown> = { ...updates };
  if (updates.startAt) { payload.GSI1SK = updates.startAt; payload.GSI2SK = updates.startAt; }
  if (updates.category) payload.GSI2PK = `CATEGORY#${updates.category}`;

  await updateItem(`WORKSHOP#${id}`, 'META', payload);
  const updated = await getItem(`WORKSHOP#${id}`, 'META');

  return ok(updated);
});
