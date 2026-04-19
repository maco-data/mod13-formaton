import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/shared/utils/dynamo-client', () => ({
  putItem: jest.fn(),
  TABLE: 'formaton-test',
}));
jest.mock('../../src/events/workshop-created', () => ({
  publishEvent: jest.fn(),
}));
jest.mock('../../src/shared/utils/reminder-scheduler', () => ({
  upsertWorkshopReminderSchedule: jest.fn(),
}));

// @ts-nocheck

import { handler } from '../../src/handlers/workshops/create';
import { putItem } from '../../src/shared/utils/dynamo-client';
import { publishEvent } from '../../src/events/workshop-created';
import { upsertWorkshopReminderSchedule } from '../../src/shared/utils/reminder-scheduler';

const mockPut = putItem as jest.MockedFunction<typeof putItem>;
const mockPublish = publishEvent as jest.MockedFunction<typeof publishEvent>;
const mockUpsertReminder = upsertWorkshopReminderSchedule as jest.MockedFunction<typeof upsertWorkshopReminderSchedule>;

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
  path: '/workshops',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

const validPayload = {
  name: 'PRL Básico',
  description: 'Sesión inicial',
  category: 'Prevención',
  mode: 'presencial',
  location: 'Sala A',
  startAt: '2026-05-10T09:00:00Z',
  endAt: '2026-05-10T17:00:00Z',
  durationHours: 8,
  capacity: 25,
  generatesCert: true,
};

describe('POST /workshops', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crea un taller válido', async () => {
    mockPut.mockResolvedValue(undefined);
    mockUpsertReminder.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue(undefined);

    const res = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(201);
    expect(mockPut).toHaveBeenCalled();
    expect(mockUpsertReminder).toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalled();
  });

  it('rechaza fechas incoherentes', async () => {
    const res = await handler(makeEvent({
      ...validPayload,
      startAt: '2026-05-10T17:00:00Z',
      endAt: '2026-05-10T09:00:00Z',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('startAt debe ser anterior a endAt');
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('rechaza capacidad no válida', async () => {
    const res = await handler(makeEvent({
      ...validPayload,
      capacity: 0,
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('capacity debe ser un entero mayor que 0');
  });

  it('requiere location en talleres presenciales o híbridos', async () => {
    const res = await handler(makeEvent({
      ...validPayload,
      location: '   ',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('location es obligatoria');
  });
});
