import { APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export const ok = (body: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

export const created = (body: unknown): APIGatewayProxyResult => ok(body, 201);

export const noContent = (): APIGatewayProxyResult => ({
  statusCode: 204,
  headers: CORS_HEADERS,
  body: '',
});

export const error = (statusCode: number, code: string, detail: string): APIGatewayProxyResult => ({
  statusCode,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/problem+json' },
  body: JSON.stringify({ type: `https://formaton.app/errors/${code}`, title: code, status: statusCode, detail }),
});

export const badRequest  = (detail: string) => error(400, 'BAD_REQUEST', detail);
export const unauthorized = ()               => error(401, 'UNAUTHORIZED', 'Token inválido o expirado');
export const forbidden   = ()                => error(403, 'FORBIDDEN', 'Sin permisos suficientes');
export const notFound    = (resource: string)=> error(404, 'NOT_FOUND', `${resource} no encontrado`);
export const conflict    = (detail: string)  => error(409, 'CONFLICT', detail);
export const internal    = (detail = 'Error interno del servidor') => error(500, 'INTERNAL_ERROR', detail);
