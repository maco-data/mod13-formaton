import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, internal } from '../utils/response';

/**
 * Wraps a Lambda handler with unified error handling and logging.
 */
export function withErrorHandler(
  handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent) => {
    try {
      return await handler(event);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string; code?: string };

      if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
        return error(e.statusCode, e.code ?? 'CLIENT_ERROR', e.message ?? 'Error del cliente');
      }

      console.error('[FormatonError]', JSON.stringify({
        message: e.message,
        stack: (err as Error).stack,
      }));

      return internal();
    }
  };
}
