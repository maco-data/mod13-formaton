import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/shared/utils/dynamo-client', () => ({
  getItem: jest.fn(),
  updateItem: jest.fn(),
  TABLE: 'formaton-test',
}));
jest.mock('../../src/events/workshop-cancelled', () => ({
  publishWorkshopCancelled: jest.fn(),
}));

// @ts-nocheck

import { handler } from '../../src/handlers/workshops/delete';
import { getItem, updateItem } from '../../src/shared/utils/dynamo-client';
import { publishWorkshopCancelled } from '../../src/events/workshop-cancelled';

const mockGet = getItem as jest.MockedFunction<typeof getItem>;
const mockUpdate = updateItem as jest.MockedFunction<typeof updateItem>;
const mockPublishCancelled = publishWorkshopCancelled as jest.MockedFunction<typeof publishWorkshopCancelled>;

const makeEvent = (workshopId: string): Partial<APIGatewayProxyEvent> => ({
  pathParameters: { id: workshopId },
  body: null,
  requestContext: {
    authorizer: {
      claims: { sub: 'admin-1', email: 'admin@empresa.es', 'cognito:groups': 'admin' },
    },
  } as never,
  queryStringParameters: null,
  headers: {},
  httpMethod: 'DELETE',
  path: `/workshops/${workshopId}`,
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('DELETE /workshops/{id}', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancela el taller y publica evento de cancelación', async () => {
    mockGet.mockResolvedValue({
      id: 'ws-1',
      name: 'PRL Básico',
      status: 'scheduled',
      startAt: '2026-04-20T09:00:00Z',
      endAt: '2026-04-20T13:00:00Z',
      mode: 'presencial',
    } as never);
    mockUpdate.mockResolvedValue(undefined);
    mockPublishCancelled.mockResolvedValue(undefined);

    const res = await handler(makeEvent('ws-1') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(204);
    expect(mockUpdate).toHaveBeenCalledWith('WORKSHOP#ws-1', 'META', { status: 'cancelled' });
    expect(mockPublishCancelled).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ws-1',
      status: 'cancelled',
    }));
  });

  it('devuelve 409 si ya estaba cancelado', async () => {
    mockGet.mockResolvedValue({ id: 'ws-1', status: 'cancelled' } as never);

    const res = await handler(makeEvent('ws-1') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockPublishCancelled).not.toHaveBeenCalled();
  });
});
