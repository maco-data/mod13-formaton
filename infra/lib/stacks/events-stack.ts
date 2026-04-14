import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';
import { CONSTANTS } from '../../config/constants';

interface EventsStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
}

export class EventsStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly dlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    // ── Dead Letter Queue ─────────────────────────────────────────────────
    this.dlq = new sqs.Queue(this, 'FormatonDLQ', {
      queueName: `formaton-dlq-${props.config.envName}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // ── Custom Event Bus ──────────────────────────────────────────────────
    this.eventBus = new events.EventBus(this, 'FormatonEventBus', {
      eventBusName: `${CONSTANTS.EVENT_BUS_NAME}-${props.config.envName}`,
    });

    // ── Archive (prod only) ───────────────────────────────────────────────
    if (props.config.envName === 'prod') {
      new events.Archive(this, 'EventArchive', {
        sourceEventBus: this.eventBus,
        archiveName: 'formaton-events-archive',
        retention: cdk.Duration.days(90),
        eventPattern: { source: [CONSTANTS.EVENT_SOURCE] },
      });
    }

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'EventBusName', { value: this.eventBus.eventBusName, exportName: `formaton-event-bus-${props.config.envName}` });
    new cdk.CfnOutput(this, 'EventBusArn', { value: this.eventBus.eventBusArn });
    new cdk.CfnOutput(this, 'DLQUrl', { value: this.dlq.queueUrl });
  }
}
