import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { ScheduledEvent } from 'aws-lambda';
import { queryItems, updateItem } from '../../shared/utils/dynamo-client';
import { Workshop } from '../../shared/models/workshop.model';
import { CONSTANTS } from '../../shared/constants';

const eb = new EventBridgeClient({});

const REMINDABLE_STATUSES = new Set<Workshop['status']>(['scheduled', 'in_progress']);

/**
 * Ejecuta cada hora y emite reminder.24h para los talleres cuyo inicio cae
 * entre las próximas 24 y 25 horas. Marca el taller para evitar duplicados.
 */
export const handler = async (_event: ScheduledEvent) => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { items } = await queryItems<Workshop>({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': 'WORKSHOP#ALL',
      ':from': windowStart.toISOString(),
      ':to': windowEnd.toISOString(),
    },
  });

  const candidates = items.filter((workshop) =>
    REMINDABLE_STATUSES.has(workshop.status) && !workshop.reminder24hSentAt
  );

  if (candidates.length === 0) {
    console.info('[DispatchReminders] Sin talleres candidatos en esta ventana.');
    return;
  }

  const dispatchedAt = new Date().toISOString();

  const publishResults = await Promise.allSettled(
    candidates.map(async (workshop) => {
      await eb.send(new PutEventsCommand({
        Entries: [{
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: CONSTANTS.EVENT_SOURCE,
          DetailType: CONSTANTS.EVENTS.REMINDER_24H,
          Detail: JSON.stringify({ workshopId: workshop.id }),
        }],
      }));

      await updateItem(`WORKSHOP#${workshop.id}`, 'META', {
        reminder24hSentAt: dispatchedAt,
      });
    })
  );

  const failed = publishResults.filter((result) => result.status === 'rejected').length;
  console.info(`[DispatchReminders] ${candidates.length - failed}/${candidates.length} recordatorios emitidos.`);
};
