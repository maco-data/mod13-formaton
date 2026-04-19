import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/shared/utils/dynamo-client', () => ({
  getItem: jest.fn(),
  putItem: jest.fn(),
  updateItem: jest.fn(),
  TABLE: 'formaton-test',
}));
jest.mock('../../src/events/cert-issued', () => ({
  publishCertIssued: jest.fn(),
}));

// @ts-nocheck

import { handler } from '../../src/handlers/certs/issue';
import { getItem, putItem, updateItem } from '../../src/shared/utils/dynamo-client';
import { publishCertIssued } from '../../src/events/cert-issued';

const mockGet = getItem as jest.MockedFunction<typeof getItem>;
const mockPut = putItem as jest.MockedFunction<typeof putItem>;
const mockUpdate = updateItem as jest.MockedFunction<typeof updateItem>;
const mockPublish = publishCertIssued as jest.MockedFunction<typeof publishCertIssued>;

const makeEvent = (body: Record<string, unknown>): Partial<APIGatewayProxyEvent> => ({
  body: JSON.stringify(body),
  pathParameters: null,
  requestContext: {
    authorizer: {
      claims: { sub: 'admin-1', email: 'admin@empresa.es', 'cognito:groups': 'admin' },
    },
  } as never,
  queryStringParameters: null,
  headers: {},
  httpMethod: 'POST',
  path: '/certs/issue',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('POST /certs/issue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emite un certificado válido', async () => {
    mockGet
      .mockResolvedValueOnce({ id: 'ws-1', name: 'PRL Básico', certNorm: 'Ley 31/1995' } as never)
      .mockResolvedValueOnce({ workshopId: 'ws-1', userId: 'user-1', certIssued: false } as never);
    mockPut.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue(undefined);

    const res = await handler(makeEvent({
      userId: 'user-1',
      workshopId: 'ws-1',
      score: 92,
      expiresAt: '2027-05-10T00:00:00Z',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(201);
    expect(mockPut).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalled();
  });

  it('rechaza score fuera de rango', async () => {
    const res = await handler(makeEvent({
      userId: 'user-1',
      workshopId: 'ws-1',
      score: 120,
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('score debe ser un número entre 0 y 100');
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('rechaza expiresAt inválido', async () => {
    const res = await handler(makeEvent({
      userId: 'user-1',
      workshopId: 'ws-1',
      expiresAt: 'mañana',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('expiresAt debe ser una fecha ISO 8601 válida');
    expect(mockPut).not.toHaveBeenCalled();
  });
});
