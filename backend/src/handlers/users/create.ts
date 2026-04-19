import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { putItem } from '../../shared/utils/dynamo-client';
import { badRequest, created } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { User, UserRole } from '../../shared/models/user.model';
import { normalizeUserInput, validateCreateUserInput } from '../../shared/validation/user';

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

  const normalized = normalizeUserInput(input);
  const role = normalized.role ?? 'student';
  const validationError = validateCreateUserInput({ ...normalized, role });
  if (validationError) return badRequest(validationError);

  const now = new Date().toISOString();
  const id = randomUUID();

  const user: User = {
    PK: `USER#${id}`,
    SK: 'META',
    id,
    email: normalized.email!,
    givenName: normalized.givenName!,
    familyName: normalized.familyName!,
    fullName: `${normalized.givenName!} ${normalized.familyName!}`.trim(),
    department: normalized.department!,
    role,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await putItem(user);

  return created(user);
});
