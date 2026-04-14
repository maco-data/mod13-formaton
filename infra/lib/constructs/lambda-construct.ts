import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

interface FormatonLambdaProps {
  handler: string;
  description: string;
  environment: Record<string, string>;
  reservedConcurrentExecutions?: number;
  enableXRay?: boolean;
  timeout?: cdk.Duration;
  memorySize?: number;
}

/**
 * Construct reutilizable para las Lambdas de Formaton.
 * Aplica configuración estándar: runtime, bundle path, X-Ray, log retention.
 */
export class FormatonLambda extends Construct {
  public readonly fn: lambda.Function;

  constructor(scope: Construct, id: string, props: FormatonLambdaProps) {
    super(scope, id);

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    this.fn = new lambda.Function(this, 'Fn', {
      functionName: `formaton-${id.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: props.handler,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      description: props.description,
      environment: props.environment,
      timeout: props.timeout ?? cdk.Duration.seconds(29),
      memorySize: props.memorySize ?? 256,
      tracing: props.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      reservedConcurrentExecutions: props.reservedConcurrentExecutions,
      logGroup,
    });
  }
}
