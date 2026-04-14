import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';

interface ObservabilityStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
  api: apigateway.RestApi;
  lambdaFunctions: lambda.Function[];
  table: dynamodb.Table;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    // ── SNS Topic para alarmas ────────────────────────────────────────────
    const alertTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `formaton-alerts-${props.config.envName}`,
      displayName: 'Formaton Alertas Operacionales',
    });
    // TODO: añadir suscriptores: new sns.EmailSubscription('ops@empresa.es')

    const alarm = (id: string, metric: cloudwatch.Metric, threshold: number, desc: string) => {
      const a = new cloudwatch.Alarm(this, id, {
        metric,
        threshold,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: desc,
      });
      a.addAlarmAction(new actions.SnsAction(alertTopic));
      return a;
    };

    // ── Alarmas API Gateway ───────────────────────────────────────────────
    alarm('Api5xxAlarm',
      new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: '5XXError', dimensionsMap: { ApiName: props.api.restApiName }, statistic: 'Sum', period: cdk.Duration.minutes(5) }),
      5, 'API Gateway > 5 errores 5XX en 5 minutos'
    );
    alarm('ApiLatencyAlarm',
      new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: 'Latency', dimensionsMap: { ApiName: props.api.restApiName }, statistic: 'p95', period: cdk.Duration.minutes(5) }),
      3000, 'API Gateway latencia P95 > 3s'
    );

    // ── Alarmas Lambda ────────────────────────────────────────────────────
    props.lambdaFunctions.forEach((fn, index) => {
      const alarmBaseId = fn.functionName
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(-48) || `Lambda${index}`;

      alarm(`${alarmBaseId}ErrorsAlarm`,
        fn.metricErrors({ period: cdk.Duration.minutes(5) }),
        3, `Lambda ${fn.functionName} > 3 errores en 5 min`
      );
      alarm(`${alarmBaseId}ThrottlesAlarm`,
        fn.metricThrottles({ period: cdk.Duration.minutes(5) }),
        5, `Lambda ${fn.functionName} > 5 throttles en 5 min`
      );
    });

    // ── Alarma DLQ ────────────────────────────────────────────────────────
    // (referenciada via SSM o cross-stack si se necesita)

    // ── Dashboard ─────────────────────────────────────────────────────────
    new cloudwatch.Dashboard(this, 'FormatonDashboard', {
      dashboardName: `formaton-${props.config.envName}`,
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'API — Requests & Errores',
            width: 12,
            left: [
              new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: 'Count', dimensionsMap: { ApiName: props.api.restApiName }, statistic: 'Sum' }),
              new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: '5XXError', dimensionsMap: { ApiName: props.api.restApiName }, statistic: 'Sum' }),
            ],
          }),
          new cloudwatch.GraphWidget({
            title: 'API — Latencia P95',
            width: 12,
            left: [
              new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: 'Latency', dimensionsMap: { ApiName: props.api.restApiName }, statistic: 'p95' }),
            ],
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Lambda — Errores globales',
            width: 24,
            left: props.lambdaFunctions.map(fn => fn.metricErrors()),
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'DynamoDB — Lecturas/Escrituras',
            width: 12,
            left: [
              new cloudwatch.Metric({ namespace: 'AWS/DynamoDB', metricName: 'ConsumedReadCapacityUnits', dimensionsMap: { TableName: props.table.tableName }, statistic: 'Sum' }),
              new cloudwatch.Metric({ namespace: 'AWS/DynamoDB', metricName: 'ConsumedWriteCapacityUnits', dimensionsMap: { TableName: props.table.tableName }, statistic: 'Sum' }),
            ],
          }),
          new cloudwatch.GraphWidget({
            title: 'DynamoDB — Errores del sistema',
            width: 12,
            left: [
              new cloudwatch.Metric({ namespace: 'AWS/DynamoDB', metricName: 'SystemErrors', dimensionsMap: { TableName: props.table.tableName }, statistic: 'Sum' }),
            ],
          }),
        ],
      ],
    });
  }
}
