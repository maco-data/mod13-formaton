import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock dynamo-client before importing handler
jest.mock('../../src/shared/utils/dynamo-client', () => ({
  queryItems: jest.fn(),
  TABLE: 'formaton-test',
}));

// @ts-nocheck

import { handler } from '../../src/handlers/workshops/list';
import { queryItems } from '../../src/shared/utils/dynamo-client';

const mockQuery = queryItems as jest.MockedFunction<typeof queryItems>;

const baseEvent = (qs: Record<string, string> = {}): Partial<APIGatewayProxyEvent> => ({
  queryStringParameters: qs,
  requestContext: {} as never,
  pathParameters: null,
  body: null,
  headers: {},
  httpMethod: 'GET',
  path: '/workshops',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('GET /workshops', () => {
  beforeEach(() => jest.clearAllMocks());

  it('devuelve lista vacía cuando no hay talleres', async () => {
    mockQuery.mockResolvedValue({ items: [] });
    const res = await handler(baseEvent() as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items).toEqual([]);
    expect(body.count).toBe(0);
  });

  it('devuelve talleres paginados', async () => {
    const workshops = [
      { id: '1', name: 'PRL Básico', GSI1PK: 'WORKSHOP#ALL', GSI1SK: '2026-04-20T09:00:00Z' },
      { id: '2', name: 'Excel', GSI1PK: 'WORKSHOP#ALL', GSI1SK: '2026-04-22T10:00:00Z' },
    ];
    mockQuery.mockResolvedValue({ items: workshops as never[], lastKey: undefined });
    const res = await handler(baseEvent() as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.count).toBe(2);
    expect(body.nextToken).toBeUndefined();
  });

  it('incluye nextToken cuando hay más páginas', async () => {
    mockQuery.mockResolvedValue({
      items: [{ id: '1' }] as never[],
      lastKey: { PK: 'WORKSHOP#1', SK: 'META' },
    });
    const res = await handler(baseEvent({ limit: '1' }) as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).nextToken).toBeDefined();
  });

  it('devuelve 400 con limit inválido', async () => {
    const res = await handler(baseEvent({ limit: 'abc' }) as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(400);
  });

  it('filtra por categoría usando GSI2', async () => {
    mockQuery.mockResolvedValue({ items: [] });
    await handler(baseEvent({ category: 'Prevención' }) as APIGatewayProxyEvent);
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ IndexName: 'GSI2' }));
  });
});
