import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryItems } from '../../shared/utils/dynamo-client';
import { ok, notFound } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { Cert } from '../../shared/models/cert.model';

/**
 * GET /certs/{id}/verify  — público
 * Permite verificar la autenticidad de un certificado por su ID.
 */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const certId = event.pathParameters?.id;
  if (!certId) return notFound('Certificado');

  const { items } = await queryItems<Cert>({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `CERT#${certId}` },
    Limit: 1,
  });

  const cert = items[0];
  if (!cert) return notFound('Certificado');

  // Comprobar si el cert ha expirado en tiempo real
  let status = cert.status;
  if (cert.expiresAt && new Date(cert.expiresAt) < new Date() && cert.status === 'valid') {
    status = 'expired';
  }

  return ok({
    certId: cert.certId,
    workshopName: cert.workshopName,
    norm: cert.norm,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
    status,
    valid: status === 'valid',
  });
});
