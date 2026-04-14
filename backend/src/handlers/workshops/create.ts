import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { putItem } from '../../shared/utils/dynamo-client';
import { created, badRequest } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { Workshop, CreateWorkshopInput } from '../../shared/models/workshop.model';
import { publishEvent } from '../../events/workshop-created';

/**
 * POST /workshops  (admin)
 * Crea un nuevo taller y emite WORKSHOP_CREATED en EventBridge.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  if (!event.body) return badRequest('Body requerido');

  let input: CreateWorkshopInput;
  try {
    input = JSON.parse(event.body);
  } catch {
    return badRequest('JSON inválido');
  }

  const { name, category, mode, startAt, endAt, durationHours, capacity } = input;
  if (!name || !category || !mode || !startAt || !endAt || !durationHours || !capacity) {
    return badRequest('Campos requeridos: name, category, mode, startAt, endAt, durationHours, capacity');
  }

  const id  = randomUUID();
  const now = new Date().toISOString();

  const workshop: Workshop = {
    PK: `WORKSHOP#${id}`,
    SK: 'META',
    id,
    name,
    description: input.description ?? '',
    category,
    mode,
    location: input.location,
    startAt,
    endAt,
    durationHours,
    capacity,
    enrolledCount: 0,
    status: 'scheduled',
    generatesCert: input.generatesCert ?? false,
    certNorm: input.certNorm,
    instructorId: input.instructorId,
    createdAt: now,
    updatedAt: now,
    GSI1PK: 'WORKSHOP#ALL',
    GSI1SK: startAt,
    GSI2PK: `CATEGORY#${category}`,
    GSI2SK: startAt,
  };

  await putItem(workshop);
  await publishEvent(workshop);

  return created(workshop);
});
