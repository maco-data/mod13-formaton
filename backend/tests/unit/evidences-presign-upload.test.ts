import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

// @ts-nocheck

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handler } from '../../src/handlers/evidences/presign-upload';

const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

const makeEvent = (
  body: Record<string, unknown>,
  groups = 'admin'
): Partial<APIGatewayProxyEvent> => ({
  pathParameters: null,
  body: JSON.stringify(body),
  requestContext: {
    authorizer: {
      claims: { sub: 'admin-1', email: 'admin@empresa.es', 'cognito:groups': groups },
    },
  } as never,
  queryStringParameters: null,
  headers: {},
  httpMethod: 'POST',
  path: '/evidences/presign-upload',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('POST /evidences/presign-upload', () => {
  const originalBucket = process.env.EVIDENCES_BUCKET;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1710000000000);
    process.env.EVIDENCES_BUCKET = 'formaton-evidences-test';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.EVIDENCES_BUCKET = originalBucket;
  });

  it('devuelve una URL firmada de subida para admin', async () => {
    mockGetSignedUrl.mockResolvedValue('https://signed-upload-url' as never);

    const res = await handler(makeEvent({
      fileName: 'Brochure PRL.pdf',
      contentType: 'application/pdf',
      folder: 'brochures',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(200);
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

    const body = JSON.parse(res.body);
    expect(body.uploadUrl).toBe('https://signed-upload-url');
    expect(body.fileKey).toBe('brochures/1710000000000-brochure-prl.pdf');
    expect(body.method).toBe('PUT');
    expect(body.headers['Content-Type']).toBe('application/pdf');
  });

  it('rechaza peticiones sin fileName', async () => {
    const res = await handler(makeEvent({
      contentType: 'application/pdf',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('fileName requerido');
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('rechaza contentType inválido', async () => {
    const res = await handler(makeEvent({
      fileName: 'brochure.pdf',
      contentType: 'pdf',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('contentType inválido');
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('devuelve 403 si el solicitante no es admin', async () => {
    const res = await handler(makeEvent({
      fileName: 'brochure.pdf',
      contentType: 'application/pdf',
    }, 'student') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(403);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });
});
