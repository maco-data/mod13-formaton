import { APIGatewayProxyEvent } from 'aws-lambda';

// @ts-nocheck

import { handler } from '../../src/handlers/healthz/get';

const makeEvent = (): Partial<APIGatewayProxyEvent> => ({
  requestContext: {} as never,
  pathParameters: null,
  queryStringParameters: null,
  body: null,
  headers: {},
  httpMethod: 'GET',
  path: '/healthz',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('GET /healthz', () => {
  it('devuelve el contrato mínimo esperado', async () => {
    const res = await handler(makeEvent() as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('formaton-api');
    expect(typeof body.timestamp).toBe('string');
  });
});
