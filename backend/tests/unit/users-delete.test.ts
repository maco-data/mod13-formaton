import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/shared/utils/dynamo-client', () => ({
  getItem: jest.fn(),
  updateItem: jest.fn(),
  TABLE: 'formaton-test',
}));

// @ts-nocheck

import { handler } from '../../src/handlers/users/delete';
import { getItem, updateItem } from '../../src/shared/utils/dynamo-client';

const mockGet = getItem as jest.MockedFunction<typeof getItem>;
const mockUpdate = updateItem as jest.MockedFunction<typeof updateItem>;

const makeEvent = (
  userId: string,
  groups = 'admin'
): Partial<APIGatewayProxyEvent> => ({
  pathParameters: { id: userId },
  body: null,
  requestContext: {
    authorizer: {
      claims: { sub: 'admin-1', email: 'admin@empresa.es', 'cognito:groups': groups },
    },
  } as never,
  queryStringParameters: null,
  headers: {},
  httpMethod: 'DELETE',
  path: `/users/${userId}`,
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('DELETE /users/{id}', () => {
  beforeEach(() => jest.clearAllMocks());

  it('desactiva al participante activo', async () => {
    mockGet.mockResolvedValue({ id: 'user-1', active: true } as never);
    mockUpdate.mockResolvedValue(undefined);

    const res = await handler(makeEvent('user-1') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(204);
    expect(mockUpdate).toHaveBeenCalledWith('USER#user-1', 'META', { active: false });
  });

  it('devuelve 409 si el participante ya estaba inactivo', async () => {
    mockGet.mockResolvedValue({ id: 'user-1', active: false } as never);

    const res = await handler(makeEvent('user-1') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).detail).toContain('ya está inactivo');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el participante no existe', async () => {
    mockGet.mockResolvedValue(null);

    const res = await handler(makeEvent('missing-user') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
