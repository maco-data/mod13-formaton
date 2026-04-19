import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/shared/utils/dynamo-client', () => ({
  getItem: jest.fn(),
  putItem: jest.fn(),
  updateItem: jest.fn(),
  TABLE: 'formaton-test',
}));
jest.mock('../../src/events/student-registered', () => ({
  publishStudentRegistered: jest.fn(),
}));

// @ts-nocheck

import { handler } from '../../src/handlers/registrations/register';
import { getItem, putItem, updateItem } from '../../src/shared/utils/dynamo-client';

const mockGet    = getItem    as jest.MockedFunction<typeof getItem>;
const mockPut    = putItem    as jest.MockedFunction<typeof putItem>;
const mockUpdate = updateItem as jest.MockedFunction<typeof updateItem>;

const baseWorkshop = {
  id: 'ws-1', name: 'PRL Básico', status: 'scheduled',
  capacity: 20, enrolledCount: 5,
};

const makeEvent = (workshopId: string, userId = 'user-99'): Partial<APIGatewayProxyEvent> => ({
  pathParameters: { id: workshopId },
  body: null,
  requestContext: {
    authorizer: {
      claims: { sub: userId, email: 'test@empresa.es', 'cognito:groups': 'student' },
    },
  } as never,
  queryStringParameters: null,
  headers: {},
  httpMethod: 'POST',
  path: `/workshops/${workshopId}/register`,
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('POST /workshops/{id}/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inscribe al usuario correctamente', async () => {
    mockGet.mockImplementation(async (pk) => {
      if (pk.startsWith('WORKSHOP#')) return baseWorkshop as never;
      return null; // no existe inscripción previa
    });
    mockPut.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);

    const res = await handler(makeEvent('ws-1') as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('confirmed');
    expect(body.workshopId).toBe('ws-1');
  });

  it('devuelve 409 cuando el taller está completo', async () => {
    mockGet.mockResolvedValue({ ...baseWorkshop, enrolledCount: 20 } as never);
    const res = await handler(makeEvent('ws-1') as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(409);
  });

  it('es idempotente: devuelve 200 si ya está inscrito', async () => {
    mockGet.mockImplementation(async (pk, sk) => {
      if (sk === 'META') return baseWorkshop as never;
      return { status: 'confirmed', workshopId: 'ws-1', userId: 'user-99' } as never;
    });
    const res = await handler(makeEvent('ws-1') as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(200);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el taller no existe', async () => {
    mockGet.mockResolvedValue(null);
    const res = await handler(makeEvent('no-existe') as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(404);
  });

  it('devuelve 403 si el taller está cancelado', async () => {
    mockGet.mockResolvedValue({ ...baseWorkshop, status: 'cancelled' } as never);
    const res = await handler(makeEvent('ws-1') as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(403);
  });
});
