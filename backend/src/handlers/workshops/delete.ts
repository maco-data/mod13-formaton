import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, updateItem } from '../../shared/utils/dynamo-client';
import { noContent, notFound, conflict } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { Workshop } from '../../shared/models/workshop.model';
import { publishWorkshopCancelled } from '../../events/workshop-cancelled';

/**
 * DELETE /workshops/{id}  (admin)
 * Soft-delete: cambia status a "cancelled". No elimina participantes.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  const id = event.pathParameters?.id;
  if (!id) return notFound('Workshop');

  const workshop = await getItem<Workshop>(`WORKSHOP#${id}`, 'META');
  if (!workshop) return notFound('Workshop');
  if (workshop.status === 'cancelled') return conflict('El taller ya está cancelado');
  if (workshop.status === 'completed') return conflict('No se puede cancelar un taller completado');

  await updateItem(`WORKSHOP#${id}`, 'META', { status: 'cancelled' });
  await publishWorkshopCancelled({ ...workshop, status: 'cancelled' });
  return noContent();
});
