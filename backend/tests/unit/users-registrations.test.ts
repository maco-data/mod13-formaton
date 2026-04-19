import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/shared/utils/dynamo-client', () => ({
  getItem: jest.fn(),
  queryItems: jest.fn(),
  TABLE: 'formaton-test',
}));

// @ts-nocheck

import { handler } from '../../src/handlers/users/registrations';
import { getItem, queryItems } from '../../src/shared/utils/dynamo-client';

const mockGet = getItem as jest.MockedFunction<typeof getItem>;
const mockQuery = queryItems as jest.MockedFunction<typeof queryItems>;

const registrations = [
  {
    workshopId: 'ws-older',
    userId: 'user-1',
    status: 'confirmed',
    registeredAt: '2026-04-15T08:00:00Z',
  },
  {
    workshopId: 'ws-newer',
    userId: 'user-1',
    status: 'completed',
    registeredAt: '2026-04-16T09:00:00Z',
  },
];

const makeEvent = (
  targetUserId: string,
  requesterId = 'user-1',
  groups?: string
): Partial<APIGatewayProxyEvent> => ({
  pathParameters: { id: targetUserId },
  body: null,
  requestContext: {
    authorizer: {
      claims: {
        sub: requesterId,
        email: 'test@empresa.es',
        ...(groups ? { 'cognito:groups': groups } : {}),
      },
    },
  } as never,
  queryStringParameters: null,
  headers: {},
  httpMethod: 'GET',
  path: `/users/${targetUserId}/registrations`,
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('GET /users/{id}/registrations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lista y ordena las inscripciones del propio usuario', async () => {
    mockQuery.mockResolvedValue({ items: registrations } as never);
    mockGet
      .mockResolvedValueOnce({ id: 'ws-older', name: 'Curso anterior' } as never)
      .mockResolvedValueOnce({ id: 'ws-newer', name: 'Curso reciente' } as never);

    const res = await handler(makeEvent('user-1') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': 'USER#user-1',
        ':prefix': 'REG#',
      },
    });

    const body = JSON.parse(res.body);
    expect(body.count).toBe(2);
    expect(body.items.map((item: { workshopId: string }) => item.workshopId)).toEqual(['ws-newer', 'ws-older']);
    expect(body.items[0].workshop.name).toBe('Curso reciente');
  });

  it('devuelve 403 si un usuario intenta consultar registros ajenos sin ser admin', async () => {
    const res = await handler(makeEvent('user-2', 'user-1') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('devuelve 404 para admin si el usuario objetivo no existe y no tiene registros', async () => {
    mockQuery.mockResolvedValue({ items: [] } as never);
    mockGet.mockResolvedValue(null as never);

    const res = await handler(makeEvent('missing-user', 'admin-1', 'admin') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(404);
    expect(mockGet).toHaveBeenCalledWith('USER#missing-user', 'META');
  });
});
