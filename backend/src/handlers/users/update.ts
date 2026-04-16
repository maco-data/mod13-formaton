import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, updateItem } from '../../shared/utils/dynamo-client';
import { badRequest, notFound, ok } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { User, UserRole } from '../../shared/models/user.model';

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

  const updates: Record<string, unknown> = {};

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email) return badRequest('email no puede estar vacío');
    updates.email = email;
  }

  const givenName = input.givenName?.trim();
  const familyName = input.familyName?.trim();
  const department = input.department?.trim();

  if (input.givenName !== undefined) {
    if (!givenName) return badRequest('givenName no puede estar vacío');
    updates.givenName = givenName;
  }

  if (input.familyName !== undefined) {
    if (!familyName) return badRequest('familyName no puede estar vacío');
    updates.familyName = familyName;
  }

  if (input.department !== undefined) {
    if (!department) return badRequest('department no puede estar vacío');
    updates.department = department;
  }

  if (input.role !== undefined) {
    if (!['admin', 'manager', 'student'].includes(input.role)) {
      return badRequest('Rol inválido');
    }
    updates.role = input.role;
  }

  if (input.active !== undefined) {
    updates.active = input.active;
  }

  const resolvedGivenName = (updates.givenName as string | undefined) ?? existing.givenName;
  const resolvedFamilyName = (updates.familyName as string | undefined) ?? existing.familyName;
  updates.fullName = `${resolvedGivenName} ${resolvedFamilyName}`.trim();

  await updateItem(`USER#${id}`, 'META', updates);
  const updated = await getItem<User>(`USER#${id}`, 'META');

  return ok(updated);
});
