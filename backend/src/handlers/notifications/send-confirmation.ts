import { EventBridgeEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getItem } from '../../shared/utils/dynamo-client';
import { User } from '../../shared/models/user.model';
import { Workshop } from '../../shared/models/workshop.model';
import { getSesFromAddress } from '../../shared/utils/app-config';

const ses = new SESClient({});

interface StudentRegisteredPayload {
  registration: { userId: string; workshopId: string; registeredAt: string };
  workshop: Workshop;
  user?: {
    id: string;
    email: string;
    givenName: string;
    familyName: string;
  };
}

/**
 * Triggered by EventBridge rule: source=formaton.app, detail-type=student.registered
 * Envía email de confirmación de inscripción al participante.
 */
export const handler = async (event: EventBridgeEvent<'student.registered', StudentRegisteredPayload>) => {
  const { registration, workshop, user: userSnapshot } = event.detail;

  const user = await getItem<User>(`USER#${registration.userId}`, 'META');
  const recipient = user ?? (userSnapshot ? {
    id: userSnapshot.id,
    email: userSnapshot.email,
    givenName: userSnapshot.givenName,
    familyName: userSnapshot.familyName,
  } : null);

  if (!recipient) {
    console.warn(`[SendConfirmation] Usuario ${registration.userId} no encontrado`);
    return;
  }

  const startDate = new Date(workshop.startAt).toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const sourceAddress = await getSesFromAddress();

  await ses.send(new SendEmailCommand({
    Source: sourceAddress,
    Destination: { ToAddresses: [recipient.email] },
    Message: {
      Subject: { Data: `✅ Inscripción confirmada: ${workshop.name}` },
      Body: {
        Html: {
          Data: `
            <h2>Hola ${recipient.givenName},</h2>
            <p>Tu inscripción a <strong>${workshop.name}</strong> ha sido confirmada.</p>
            <ul>
              <li><strong>Fecha:</strong> ${startDate}</li>
              <li><strong>Modalidad:</strong> ${workshop.mode}</li>
              ${workshop.location ? `<li><strong>Lugar:</strong> ${workshop.location}</li>` : ''}
              <li><strong>Duración:</strong> ${workshop.durationHours}h</li>
            </ul>
            <p>Recibirás un recordatorio 24h antes del inicio.</p>
            <p>— Equipo Formaton</p>
          `,
        },
      },
    },
  }));

  console.log(`[SendConfirmation] Email enviado a ${recipient.email} para taller ${workshop.id}`);
};
