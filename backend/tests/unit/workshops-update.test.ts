import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/shared/utils/dynamo-client', () => ({
  getItem: jest.fn(),
  updateItem: jest.fn(),
  TABLE: 'formaton-test',
}));
jest.mock('../../src/shared/utils/reminder-scheduler', () => ({
  upsertWorkshopReminderSchedule: jest.fn(),
}));

// @ts-nocheck

import { handler } from '../../src/handlers/workshops/update';
import { getItem, updateItem } from '../../src/shared/utils/dynamo-client';
import { upsertWorkshopReminderSchedule } from '../../src/shared/utils/reminder-scheduler';

const mockGet = getItem as jest.MockedFunction<typeof getItem>;
const mockUpdate = updateItem as jest.MockedFunction<typeof updateItem>;
const mockUpsertReminder = upsertWorkshopReminderSchedule as jest.MockedFunction<typeof upsertWorkshopReminderSchedule>;

const existingWorkshop = {
  PK: 'WORKSHOP#ws-1',
  SK: 'META',
  id: 'ws-1',
  name: 'PRL Básico',
  description: 'Sesión inicial',
  category: 'Prevención',
  mode: 'presencial',
  location: 'Sala A',
  startAt: '2026-05-10T09:00:00Z',
  endAt: '2026-05-10T17:00:00Z',
  durationHours: 8,
  capacity: 25,
  enrolledCount: 10,
  status: 'scheduled',
  generatesCert: false,
  createdAt: '2026-04-01T10:00:00Z',
  updatedAt: '2026-04-01T10:00:00Z',
  GSI1PK: 'WORKSHOP#ALL',
  GSI1SK: '2026-05-10T09:00:00Z',
  GSI2PK: 'CATEGORY#Prevención',
  GSI2SK: '2026-05-10T09:00:00Z',
};

const makeEvent = (body: Record<string, unknown>): Partial<APIGatewayProxyEvent> => ({
  pathParameters: { id: 'ws-1' },
  body: JSON.stringify(body),
  requestContext: {
    authorizer: {
      claims: { sub: 'admin-1', email: 'admin@empresa.es', 'cognito:groups': 'admin' },
    },
  } as never,
  queryStringParameters: null,
  headers: {},
  httpMethod: 'PUT',
  path: '/workshops/ws-1',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('PUT /workshops/{id}', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet
      .mockResolvedValueOnce(existingWorkshop as never)
      .mockResolvedValueOnce({ ...existingWorkshop, name: 'Actualizado' } as never);
  });

  it('actualiza un taller válido', async () => {
    mockUpdate.mockResolvedValue(undefined);
    mockUpsertReminder.mockResolvedValue(undefined);

    const res = await handler(makeEvent({ name: 'Actualizado' }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('WORKSHOP#ws-1', 'META', { name: 'Actualizado' });
    expect(mockUpsertReminder).toHaveBeenCalled();
  });

  it('rechaza reducir la capacidad por debajo de inscritos', async () => {
    const res = await handler(makeEvent({ capacity: 5 }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('capacity no puede ser menor que enrolledCount');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rechaza endAt anterior a startAt', async () => {
    const res = await handler(makeEvent({ endAt: '2026-05-10T08:00:00Z' }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('startAt debe ser anterior a endAt');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
