import { EventBridgeEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getItem, queryItems } from '../../shared/utils/dynamo-client';
import { Workshop } from '../../shared/models/workshop.model';
import { Registration } from '../../shared/models/registration.model';
import { User } from '../../shared/models/user.model';

const ses = new SESClient({});

interface WorkshopCancelledPayload {
  workshop: Workshop;
}

const ACTIVE_REGISTRATION_STATUSES = new Set<Registration['status']>(['confirmed', 'waitlist']);

/**
 * Triggered by EventBridge rule: source=formaton.app, detail-type=workshop.cancelled
 * Envía un aviso a los participantes inscritos activos cuando una formación se cancela.
 */
export const handler = async (event: EventBridgeEvent<'workshop.cancelled', WorkshopCancelledPayload>) => {
  const workshop = event.detail.workshop;

  const { items: registrations } = await queryItems<Registration>({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `WORKSHOP#${workshop.id}`,
      ':prefix': 'REG#USER#',
    },
  });

  const activeRegistrations = registrations.filter((registration) =>
    ACTIVE_REGISTRATION_STATUSES.has(registration.status)
  );

  if (activeRegistrations.length === 0) {
    console.info(`[SendCancellation] Taller ${workshop.id}: sin inscritos activos, no se envían correos.`);
    return;
  }

  const startDate = new Date(workshop.startAt).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const results = await Promise.allSettled(
    activeRegistrations.map(async (registration) => {
      const user = await getItem<User>(`USER#${registration.userId}`, 'META');
      if (!user) {
        console.warn(`[SendCancellation] Usuario ${registration.userId} no encontrado`);
        return;
      }

      await ses.send(new SendEmailCommand({
        Source: process.env.SES_FROM ?? 'formaton@tuempresa.es',
        Destination: { ToAddresses: [user.email] },
        Message: {
          Subject: { Data: `Cancelación de formación: ${workshop.name}` },
          Body: {
            Html: {
              Data: `
                <h2>Hola ${user.givenName},</h2>
                <p>La formación <strong>${workshop.name}</strong> ha sido cancelada por el equipo administrador.</p>
                <ul>
                  <li><strong>Fecha prevista:</strong> ${startDate}</li>
                  <li><strong>Modalidad:</strong> ${workshop.mode}</li>
                  ${workshop.location ? `<li><strong>Lugar:</strong> ${workshop.location}</li>` : ''}
                </ul>
                <p>Tu inscripción quedará sin efecto. Si se reprograma, recibirás una nueva invitación.</p>
                <p>— Equipo Formaton</p>
              `,
            },
          },
        },
      }));
    })
  );

  const failed = results.filter((result) => result.status === 'rejected').length;
  console.info(`[SendCancellation] Taller ${workshop.id}: ${activeRegistrations.length} notificaciones, ${failed} fallidas`);
};
