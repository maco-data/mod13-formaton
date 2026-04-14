import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getItem, putItem, updateItem } from '../../shared/utils/dynamo-client';
import { created, notFound, badRequest, conflict } from '../../shared/utils/response';
import { withErrorHandler } from '../../shared/middleware/error-handler';
import { requireAdmin } from '../../shared/middleware/auth';
import { Cert, IssueCertInput } from '../../shared/models/cert.model';
import { Workshop } from '../../shared/models/workshop.model';
import { Registration } from '../../shared/models/registration.model';
import { publishCertIssued } from '../../events/cert-issued';

/** POST /certs/issue  (admin) */
export const handler = withErrorHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  requireAdmin(event);

  if (!event.body) return badRequest('Body requerido');
  let input: IssueCertInput;
  try { input = JSON.parse(event.body); } catch { return badRequest('JSON inválido'); }

  const { userId, workshopId, score, expiresAt } = input;
  if (!userId || !workshopId) return badRequest('userId y workshopId requeridos');

  const [workshop, reg] = await Promise.all([
    getItem<Workshop>(`WORKSHOP#${workshopId}`, 'META'),
    getItem<Registration>(`WORKSHOP#${workshopId}`, `REG#USER#${userId}`),
  ]);

  if (!workshop) return notFound('Workshop');
  if (!reg) return notFound('Inscripción: el usuario no está inscrito en este taller');
  if (reg.certIssued) return conflict('Ya se emitió un certificado para esta inscripción');

  const certId = randomUUID();
  const now = new Date().toISOString();

  const cert: Cert = {
    PK: `USER#${userId}`,
    SK: `CERT#${certId}`,
    certId,
    userId,
    workshopId,
    workshopName: workshop.name,
    norm: workshop.certNorm,
    issuedAt: now,
    expiresAt,
    status: 'valid',
    score,
    GSI1PK: `CERT#${certId}`,
    GSI1SK: now,
  };

  await putItem(cert);
  await updateItem(`WORKSHOP#${workshopId}`, `REG#USER#${userId}`, { certIssued: true, certId, score });
  await publishCertIssued(cert);

  return created(cert);
});
