import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';
import { CONSTANTS } from '../../config/constants';

interface EventTargetsStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
  sendConfirmationTarget: lambda.IFunction;
  sendCancellationTarget: lambda.IFunction;
}

export class EventTargetsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EventTargetsStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    const eventBus = events.EventBus.fromEventBusName(
      this,
      'ImportedFormatonEventBus',
      `${CONSTANTS.EVENT_BUS_NAME}-${props.config.envName}`
    );
    const dlqArn = cdk.Stack.of(this).formatArn({
      service: 'sqs',
      resource: `formaton-dlq-${props.config.envName}`,
    });
    const dlq = sqs.Queue.fromQueueArn(this, 'ImportedFormatonDlq', dlqArn);

    new events.Rule(this, 'StudentRegisteredRule', {
      eventBus,
      description: 'Dispara la notificación de confirmación al registrarse un estudiante',
      eventPattern: {
        source: ['formaton.app'],
        detailType: ['student.registered'],
      },
      targets: [new targets.LambdaFunction(props.sendConfirmationTarget, {
        deadLetterQueue: dlq,
        retryAttempts: 2,
        maxEventAge: cdk.Duration.hours(2),
      })],
    });

    new events.Rule(this, 'WorkshopCancelledRule', {
      eventBus,
      description: 'Dispara la notificación a inscritos cuando se cancela una formación',
      eventPattern: {
        source: ['formaton.app'],
        detailType: ['workshop.cancelled'],
      },
      targets: [new targets.LambdaFunction(props.sendCancellationTarget, {
        deadLetterQueue: dlq,
        retryAttempts: 2,
        maxEventAge: cdk.Duration.hours(2),
      })],
    });
  }
}
