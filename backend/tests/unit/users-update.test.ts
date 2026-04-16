import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/shared/utils/dynamo-client', () => ({
  getItem: jest.fn(),
  updateItem: jest.fn(),
  TABLE: 'formaton-test',
}));

// @ts-nocheck

import { handler } from '../../src/handlers/users/update';
import { getItem, updateItem } from '../../src/shared/utils/dynamo-client';

const mockGet = getItem as jest.MockedFunction<typeof getItem>;
const mockUpdate = updateItem as jest.MockedFunction<typeof updateItem>;

const existingUser = {
  PK: 'USER#user-1',
  SK: 'META',
  id: 'user-1',
  email: 'ana@empresa.es',
  givenName: 'Ana',
  familyName: 'Gomez',
  fullName: 'Ana Gomez',
  department: 'Operaciones',
  role: 'student',
  active: true,
  createdAt: '2026-04-01T10:00:00Z',
  updatedAt: '2026-04-01T10:00:00Z',
};

const makeEvent = (
  body: Record<string, unknown>,
  groups = 'admin'
): Partial<APIGatewayProxyEvent> => ({
  pathParameters: { id: 'user-1' },
  body: JSON.stringify(body),
  requestContext: {
    authorizer: {
      claims: { sub: 'admin-1', email: 'admin@empresa.es', 'cognito:groups': groups },
    },
  } as never,
  queryStringParameters: null,
  headers: {},
  httpMethod: 'PUT',
  path: '/users/user-1',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('PUT /users/{id}', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('actualiza campos válidos y recalcula fullName', async () => {
    mockGet
      .mockResolvedValueOnce(existingUser as never)
      .mockResolvedValueOnce({
        ...existingUser,
        email: 'nuevo@empresa.es',
        givenName: 'Lucia',
        familyName: 'Perez',
        fullName: 'Lucia Perez',
        role: 'manager',
      } as never);
    mockUpdate.mockResolvedValue(undefined);

    const res = await handler(
      makeEvent({
        email: '  NUEVO@empresa.es ',
        givenName: '  Lucia ',
        familyName: ' Perez ',
        role: 'manager',
      }) as APIGatewayProxyEvent
    );

    expect(res.statusCode).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('USER#user-1', 'META', {
      email: 'nuevo@empresa.es',
      givenName: 'Lucia',
      familyName: 'Perez',
      role: 'manager',
      fullName: 'Lucia Perez',
    });
  });

  it('rechaza roles inválidos', async () => {
    mockGet.mockResolvedValue(existingUser as never);

    const res = await handler(makeEvent({ role: 'guest' }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('Rol inválido');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('devuelve 403 si el solicitante no es admin', async () => {
    const res = await handler(makeEvent({ givenName: 'Lucia' }, 'student') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(403);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
