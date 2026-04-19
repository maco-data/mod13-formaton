import { Workshop } from '../models/workshop.model';

type SchedulerSdk = {
  SchedulerClient: new (config: { region: string }) => { send: (command: unknown) => Promise<unknown> };
  CreateScheduleCommand: new (input: Record<string, unknown>) => unknown;
  UpdateScheduleCommand: new (input: Record<string, unknown>) => unknown;
  DeleteScheduleCommand: new (input: Record<string, unknown>) => unknown;
};

function loadSchedulerSdk(): SchedulerSdk {
  return require('@aws-sdk/client-scheduler') as SchedulerSdk;
}

function createSchedulerClient() {
  const { SchedulerClient } = loadSchedulerSdk();
  return new SchedulerClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });
}

function getScheduleName(workshopId: string): string {
  return `formaton-reminder-${workshopId}`.slice(0, 64);
}

function getScheduleGroup(): string {
  const group = process.env.REMINDER_SCHEDULE_GROUP;
  if (!group) throw new Error('REMINDER_SCHEDULE_GROUP no configurado');
  return group;
}

function getScheduleTargetConfig(workshopId: string) {
  const targetArn = process.env.REMINDER_TARGET_ARN;
  const roleArn = process.env.REMINDER_SCHEDULE_ROLE_ARN;
  if (!targetArn || !roleArn) {
    throw new Error('Configuración de Scheduler incompleta');
  }

  const dlqArn = process.env.REMINDER_SCHEDULE_DLQ_ARN;

  return {
    Arn: targetArn,
    RoleArn: roleArn,
    Input: JSON.stringify({ workshopId }),
    RetryPolicy: {
      MaximumEventAgeInSeconds: 3600,
      MaximumRetryAttempts: 2,
    },
    ...(dlqArn ? { DeadLetterConfig: { Arn: dlqArn } } : {}),
  };
}

function shouldHaveReminder(workshop: Workshop): boolean {
  if (workshop.status === 'cancelled' || workshop.status === 'completed') return false;
  const reminderAt = new Date(new Date(workshop.startAt).getTime() - 24 * 60 * 60 * 1000);
  return reminderAt.getTime() > Date.now();
}

export async function upsertWorkshopReminderSchedule(workshop: Workshop): Promise<void> {
  const scheduler = createSchedulerClient();
  const { UpdateScheduleCommand, CreateScheduleCommand } = loadSchedulerSdk();
  const name = getScheduleName(workshop.id);
  const groupName = getScheduleGroup();

  if (!shouldHaveReminder(workshop)) {
    await deleteWorkshopReminderSchedule(workshop.id);
    return;
  }

  const reminderAt = new Date(new Date(workshop.startAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const target = getScheduleTargetConfig(workshop.id);

  try {
    await scheduler.send(new UpdateScheduleCommand({
      Name: name,
      GroupName: groupName,
      ScheduleExpression: `at(${reminderAt})`,
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      State: 'ENABLED',
      Description: `Recordatorio 24h antes para ${workshop.id}`,
      Target: target,
    }));
  } catch (error) {
    const err = error as { name?: string };
    if (err.name !== 'ResourceNotFoundException') throw error;

    await scheduler.send(new CreateScheduleCommand({
      Name: name,
      GroupName: groupName,
      ScheduleExpression: `at(${reminderAt})`,
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      State: 'ENABLED',
      Description: `Recordatorio 24h antes para ${workshop.id}`,
      Target: target,
    }));
  }
}

export async function deleteWorkshopReminderSchedule(workshopId: string): Promise<void> {
  const scheduler = createSchedulerClient();
  const { DeleteScheduleCommand } = loadSchedulerSdk();
  const name = getScheduleName(workshopId);
  const groupName = getScheduleGroup();

  try {
    await scheduler.send(new DeleteScheduleCommand({
      Name: name,
      GroupName: groupName,
    }));
  } catch (error) {
    const err = error as { name?: string };
    if (err.name !== 'ResourceNotFoundException') throw error;
  }
}
