import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Registration } from '../shared/models/registration.model';
import { Workshop } from '../shared/models/workshop.model';
import { CONSTANTS } from '../shared/constants';

const eb = new EventBridgeClient({});

interface StudentRegisteredPayload {
  registration: Registration;
  workshop: Workshop;
  user: {
    id: string;
    email: string;
    givenName: string;
    familyName: string;
  };
}

export async function publishStudentRegistered(payload: StudentRegisteredPayload): Promise<void> {
  await eb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: CONSTANTS.EVENT_SOURCE,
      DetailType: CONSTANTS.EVENTS.STUDENT_REGISTERED,
      Detail: JSON.stringify(payload),
    }],
  }));
}
