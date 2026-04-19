import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ok } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';

/**
 * GET /healthz
 * Endpoint liviano para smoke tests y verificación operativa básica.
 */
export const handler = withErrorHandler(async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return ok({
    status: 'ok',
    service: 'formaton-api',
    env: process.env.ENV ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});
