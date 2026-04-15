import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { putItem } from '../../shared/utils/dynamo-client';
import { badRequest, created } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { User, UserRole } from '../../shared/models/user.model';

type CreateUserInput = {
  email?: string;
  givenName?: string;
  familyName?: string;
  department?: string;
  role?: UserRole;
};

/**
 * POST /users
 * Crea un perfil de participante gestionado desde la aplicación.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  if (!event.body) return badRequest('Body requerido');

  let input: CreateUserInput;
  try {
    input = JSON.parse(event.body);
  } catch {
    return badRequest('JSON inválido');
  }

  const email = input.email?.trim().toLowerCase();
  const givenName = input.givenName?.trim();
  const familyName = input.familyName?.trim();
  const department = input.department?.trim();
  const role = input.role ?? 'student';

  if (!email || !givenName || !familyName || !department) {
    return badRequest('Campos requeridos: email, givenName, familyName, department');
  }

  if (!['admin', 'manager', 'student'].includes(role)) {
    return badRequest('Rol inválido');
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  const user: User = {
    PK: `USER#${id}`,
    SK: 'META',
    id,
    email,
    givenName,
    familyName,
    fullName: `${givenName} ${familyName}`.trim(),
    department,
    role,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await putItem(user);

  return created(user);
});
