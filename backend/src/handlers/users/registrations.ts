import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, queryItems } from '../../shared/utils/dynamo-client';
import { badRequest, forbidden, notFound, ok } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { getUserId, isAdmin } from '../../shared/middleware/auth';
import { Registration } from '../../shared/models/registration.model';
import { Workshop } from '../../shared/models/workshop.model';

type UserWorkshopRegistration = Registration & {
  workshop?: Workshop | null;
};

export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const targetUserId = event.pathParameters?.id;
  if (!targetUserId) return badRequest('userId requerido');

  const requesterId = getUserId(event);
  if (!isAdmin(event) && requesterId !== targetUserId) return forbidden();

  const { items } = await queryItems<Registration>({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${targetUserId}`,
      ':prefix': 'REG#',
    },
  });

  if (items.length === 0 && requesterId !== targetUserId && isAdmin(event)) {
    const user = await getItem(`USER#${targetUserId}`, 'META');
    if (!user) return notFound('User');
  }

  const hydratedItems: UserWorkshopRegistration[] = await Promise.all(
    items.map(async (registration) => ({
      ...registration,
      workshop: await getItem<Workshop>(`WORKSHOP#${registration.workshopId}`, 'META'),
    }))
  );

  const sorted = hydratedItems.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  return ok({ items: sorted, count: sorted.length });
});
