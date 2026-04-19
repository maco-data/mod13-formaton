import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, updateItem } from '../../shared/utils/dynamo-client';
import { badRequest, notFound, ok } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { User, UserRole } from '../../shared/models/user.model';
import { normalizeUserInput, validateUpdateUserInput } from '../../shared/validation/user';

type UpdateUserInput = {
  email?: string;
  givenName?: string;
  familyName?: string;
  department?: string;
  role?: UserRole;
  active?: boolean;
};

export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  const id = event.pathParameters?.id;
  if (!id) return notFound('User');
  if (!event.body) return badRequest('Body requerido');

  const existing = await getItem<User>(`USER#${id}`, 'META');
  if (!existing) return notFound('User');

  let input: UpdateUserInput;
  try {
    input = JSON.parse(event.body);
  } catch {
    return badRequest('JSON inválido');
  }

  const normalized = normalizeUserInput(input);
  const validationError = validateUpdateUserInput(normalized);
  if (validationError) return badRequest(validationError);

  const updates: Record<string, unknown> = {};
  if (normalized.email !== undefined) updates.email = normalized.email;
  if (normalized.givenName !== undefined) updates.givenName = normalized.givenName;
  if (normalized.familyName !== undefined) updates.familyName = normalized.familyName;
  if (normalized.department !== undefined) updates.department = normalized.department;
  if (normalized.role !== undefined) updates.role = normalized.role;
  if (normalized.active !== undefined) updates.active = normalized.active;

  const resolvedGivenName = (updates.givenName as string | undefined) ?? existing.givenName;
  const resolvedFamilyName = (updates.familyName as string | undefined) ?? existing.familyName;
  updates.fullName = `${resolvedGivenName} ${resolvedFamilyName}`.trim();

  await updateItem(`USER#${id}`, 'META', updates);
  const updated = await getItem<User>(`USER#${id}`, 'META');

  return ok(updated);
});
