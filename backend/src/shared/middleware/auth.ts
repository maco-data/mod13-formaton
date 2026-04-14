import { APIGatewayProxyEvent } from 'aws-lambda';

export type CognitoClaims = {
  sub: string;
  email: string;
  given_name: string;
  family_name: string;
  'cognito:groups'?: string[];
  'custom:role'?: string;
  'custom:department'?: string;
};

/**
 * Extrae los claims del JWT de Cognito inyectados por API Gateway Authorizer.
 * No valida la firma (API GW ya lo hace). Falla si no hay contexto.
 */
export function getClaims(event: APIGatewayProxyEvent): CognitoClaims {
  const ctx = event.requestContext?.authorizer?.claims;
  if (!ctx) throw new Error('No authorizer claims found');
  return ctx as CognitoClaims;
}

export function getUserId(event: APIGatewayProxyEvent): string {
  return getClaims(event).sub;
}

export function getGroups(event: APIGatewayProxyEvent): string[] {
  const raw = getClaims(event)['cognito:groups'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : String(raw).split(',');
}

export function isAdmin(event: APIGatewayProxyEvent): boolean {
  return getGroups(event).includes('admin');
}

export function isManagerOrAdmin(event: APIGatewayProxyEvent): boolean {
  const groups = getGroups(event);
  return groups.includes('admin') || groups.includes('manager');
}

export function requireAdmin(event: APIGatewayProxyEvent): void {
  if (!isAdmin(event)) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
}
