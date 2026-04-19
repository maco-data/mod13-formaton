import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

// @ts-nocheck

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handler } from '../../src/handlers/evidences/presign-download';

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
  path: '/evidences/presign-download',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '',
});

describe('POST /evidences/presign-download', () => {
  const originalBucket = process.env.EVIDENCES_BUCKET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EVIDENCES_BUCKET = 'formaton-evidences-test';
  });

  afterAll(() => {
    process.env.EVIDENCES_BUCKET = originalBucket;
  });

  it('devuelve una URL firmada de descarga para admin', async () => {
    mockGetSignedUrl.mockResolvedValue('https://signed-download-url' as never);

    const res = await handler(makeEvent({
      fileKey: 'brochures/1710000000000-brochure-prl.pdf',
      downloadName: 'PRL brochure.pdf',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(200);
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

    const body = JSON.parse(res.body);
    expect(body.downloadUrl).toBe('https://signed-download-url');
    expect(body.fileKey).toBe('brochures/1710000000000-brochure-prl.pdf');
    expect(body.method).toBe('GET');
  });

  it('rechaza fileKey peligrosos', async () => {
    const res = await handler(makeEvent({
      fileKey: '../secrets.txt',
    }) as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).detail).toContain('fileKey inválido');
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('devuelve 403 si el solicitante no es admin', async () => {
    const res = await handler(makeEvent({
      fileKey: 'brochures/brochure.pdf',
    }, 'student') as APIGatewayProxyEvent);

    expect(res.statusCode).toBe(403);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });
});
