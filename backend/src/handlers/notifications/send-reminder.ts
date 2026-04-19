import { EventBridgeEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { queryItems, getItem } from '../../shared/utils/dynamo-client';
import { User } from '../../shared/models/user.model';
import { Workshop } from '../../shared/models/workshop.model';
import { Registration } from '../../shared/models/registration.model';
import { getSesFromAddress } from '../../shared/utils/app-config';

const ses = new SESClient({});

interface ReminderPayload {
  workshopId: string;
}

/**
 * Triggered by EventBridge Scheduler 24h antes del startAt de cada taller.
 * Consulta todos los inscritos confirmados y envía email de recordatorio.
 */
export const handler = async (event: EventBridgeEvent<'reminder.24h', ReminderPayload>) => {
  const { workshopId } = event.detail;

  const workshop = await getItem<Workshop>(`WORKSHOP#${workshopId}`, 'META');
  if (!workshop || workshop.status === 'cancelled') {
    console.info(`[SendReminder] Taller ${workshopId} no encontrado o cancelado, omitiendo.`);
    return;
  }

  const { items: registrations } = await queryItems<Registration>({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `WORKSHOP#${workshopId}`,
      ':prefix': 'REG#USER#',
    },
    FilterExpression: '#status = :confirmed',
    ExpressionAttributeNames: { '#status': 'status' },
  });

  const startDate = new Date(workshop.startAt).toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const sourceAddress = await getSesFromAddress();

  const results = await Promise.allSettled(
    registrations.map(async (reg) => {
      const user = await getItem<User>(`USER#${reg.userId}`, 'META');
      if (!user) return;

      await ses.send(new SendEmailCommand({
        Source: sourceAddress,
        Destination: { ToAddresses: [user.email] },
        Message: {
          Subject: { Data: `⏰ Recordatorio: ${workshop.name} — mañana` },
          Body: {
            Html: {
              Data: `
                <h2>Hola ${user.givenName},</h2>
                <p>Te recordamos que mañana tienes la formación:</p>
                <h3>${workshop.name}</h3>
                <ul>
                  <li><strong>Cuándo:</strong> ${startDate}</li>
                  <li><strong>Modalidad:</strong> ${workshop.mode}</li>
                  ${workshop.location ? `<li><strong>Lugar:</strong> ${workshop.location}</li>` : ''}
                  <li><strong>Duración:</strong> ${workshop.durationHours}h</li>
                </ul>
                ${workshop.generatesCert ? '<p>🎓 Esta formación genera certificado al finalizar.</p>' : ''}
                <p>¡Hasta mañana!</p>
                <p>— Equipo Formaton</p>
              `,
            },
          },
        },
      }));
    })
  );

  const failed = results.filter(r => r.status === 'rejected').length;
  console.info(`[SendReminder] Taller ${workshopId}: ${registrations.length} recordatorios, ${failed} fallidos`);
};
