import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Workshop } from '../shared/models/workshop.model';
import { CONSTANTS } from '../shared/constants';

const eb = new EventBridgeClient({});

export async function publishEvent(workshop: Workshop): Promise<void> {
  await eb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: CONSTANTS.EVENT_SOURCE,
      DetailType: CONSTANTS.EVENTS.WORKSHOP_CREATED,
      Detail: JSON.stringify(workshop),
    }],
  }));
}
