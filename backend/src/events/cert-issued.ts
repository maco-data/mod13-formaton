import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Cert } from '../shared/models/cert.model';
import { CONSTANTS } from '../shared/constants';

const eb = new EventBridgeClient({});

export async function publishCertIssued(cert: Cert): Promise<void> {
  await eb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: CONSTANTS.EVENT_SOURCE,
      DetailType: CONSTANTS.EVENTS.CERT_ISSUED,
      Detail: JSON.stringify(cert),
    }],
  }));
}
