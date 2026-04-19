import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';
import { CONSTANTS } from '../../config/constants';
import { FormatonLambda } from '../constructs/lambda-construct';

interface ApiStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
  userPool: cognito.UserPool;
  table: dynamodb.Table;
  evidencesBucket: s3.Bucket;
  appSecret: secretsmanager.ISecret;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiUrl: string;
  public readonly lambdaFunctions: lambda.Function[];
  public readonly lambdaAliases: lambda.Alias[];
  public readonly sendConfirmationTarget: lambda.IFunction;
  public readonly sendCancellationTarget: lambda.IFunction;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    const eventBusName = `${CONSTANTS.EVENT_BUS_NAME}-${props.config.envName}`;
    const eventBusArn = cdk.Stack.of(this).formatArn({
      service: 'events',
      resource: 'event-bus',
      resourceName: eventBusName,
    });
    const dlqName = `formaton-dlq-${props.config.envName}`;
    const dlqArn = cdk.Stack.of(this).formatArn({
      service: 'sqs',
      resource: dlqName,
    });

    // ── Shared Lambda environment ─────────────────────────────────────────
    const sharedEnv = {
      TABLE_NAME: props.table.tableName,
      EVIDENCES_BUCKET: props.evidencesBucket.bucketName,
      EVENT_BUS_NAME: eventBusName,
      ENV: props.config.envName,
      LOG_LEVEL: props.config.envName === 'prod' ? 'WARN' : 'DEBUG',
      REMINDER_SCHEDULE_DLQ_ARN: dlqArn,
      APP_CONFIG_SECRET_ID: props.appSecret.secretArn,
    };

    // ── Lambda factory helper ─────────────────────────────────────────────
    const fn = (id: string, handler: string, description: string) =>
      new FormatonLambda(this, id, {
        handler,
        description,
        environment: sharedEnv,
        reservedConcurrentExecutions: props.config.lambdaReservedConcurrency,
        enableXRay: props.config.enableXRay,
        enableDeploymentAlias: props.config.enableBlueGreenDeployments,
      });

    const integrationTarget = (handler: FormatonLambda): lambda.IFunction => handler.liveAlias ?? handler.fn;

    const deploymentConfig = props.config.envName === 'prod'
      ? codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE
      : codedeploy.LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES;

    // ── Handlers ──────────────────────────────────────────────────────────
    const listWorkshops       = fn('ListWorkshops',       'handlers/workshops/list.handler',             'GET /workshops — listado paginado');
    const getWorkshop         = fn('GetWorkshop',         'handlers/workshops/get.handler',              'GET /workshops/{id}');
    const createWorkshop      = fn('CreateWorkshop',      'handlers/workshops/create.handler',           'POST /workshops (admin)');
    const updateWorkshop      = fn('UpdateWorkshop',      'handlers/workshops/update.handler',           'PUT /workshops/{id} (admin)');
    const deleteWorkshop      = fn('DeleteWorkshop',      'handlers/workshops/delete.handler',           'DELETE /workshops/{id} (admin)');
    const registerStudent     = fn('RegisterStudent',     'handlers/registrations/register.handler',     'POST /workshops/{id}/register (student)');
    const unregisterStudent   = fn('UnregisterStudent',   'handlers/registrations/unregister.handler',   'DELETE /workshops/{id}/register (student)');
    const listRegistrations   = fn('ListRegistrations',   'handlers/registrations/list.handler',         'GET /workshops/{id}/registrations (admin)');
    const issueCert           = fn('IssueCert',           'handlers/certs/issue.handler',                'POST /certs/issue (admin)');
    const listCerts           = fn('ListCerts',           'handlers/certs/list.handler',                 'GET /certs');
    const verifyCert          = fn('VerifyCert',          'handlers/certs/verify.handler',               'GET /certs/{id}/verify (público)');
    const listUsers           = fn('ListUsers',           'handlers/users/list.handler',                 'GET /users (admin)');
    const getUser             = fn('GetUser',             'handlers/users/get.handler',                  'GET /users/{id}');
    const createUser          = fn('CreateUser',          'handlers/users/create.handler',               'POST /users (admin)');
    const updateUser          = fn('UpdateUser',          'handlers/users/update.handler',               'PUT /users/{id} (admin)');
    const deleteUser          = fn('DeleteUser',          'handlers/users/delete.handler',               'DELETE /users/{id} (admin)');
    const listUserRegistrations = fn('ListUserRegistrations', 'handlers/users/registrations.handler',   'GET /users/{id}/registrations');
    const presignEvidenceUpload = fn('PresignEvidenceUpload', 'handlers/evidences/presign-upload.handler', 'POST /evidences/presign-upload (admin)');
    const presignEvidenceDownload = fn('PresignEvidenceDownload', 'handlers/evidences/presign-download.handler', 'POST /evidences/presign-download (admin)');
    const healthz             = fn('Healthz',             'handlers/healthz/get.handler',                'GET /healthz');
    const sendConfirmation    = fn('SendConfirmation',    'handlers/notifications/send-confirmation.handler', 'Notificación de inscripción');
    const sendReminder        = fn('SendReminder',        'handlers/notifications/send-reminder.handler',    'Recordatorio 24h antes');
    const sendCancellation    = fn('SendCancellation',    'handlers/notifications/send-cancellation.handler', 'Notificación de cancelación');
    const dispatchReminders   = fn('DispatchReminders',   'handlers/notifications/dispatch-reminders.handler', 'Despacha recordatorios 24h');

    const handlers = [
      healthz,
      listWorkshops, getWorkshop, createWorkshop, updateWorkshop, deleteWorkshop,
      registerStudent, unregisterStudent, listRegistrations,
      issueCert, listCerts, verifyCert,
      listUsers, getUser, createUser, updateUser, deleteUser, listUserRegistrations,
      presignEvidenceUpload, presignEvidenceDownload,
      sendConfirmation, sendReminder, sendCancellation, dispatchReminders,
    ];

    const reminderScheduleGroup = new scheduler.CfnScheduleGroup(this, 'ReminderScheduleGroup', {
      name: `formaton-reminders-${props.config.envName}`,
    });

    const schedulerInvokeRole = new iam.Role(this, 'ReminderSchedulerInvokeRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      description: 'Permite a EventBridge Scheduler invocar la Lambda de recordatorios de Formaton',
    });

    const reminderTarget = integrationTarget(sendReminder);
    this.sendConfirmationTarget = integrationTarget(sendConfirmation);
    this.sendCancellationTarget = integrationTarget(sendCancellation);
    reminderTarget.grantInvoke(schedulerInvokeRole);

    reminderTarget.addPermission('AllowSchedulerInvokeReminder', {
      principal: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: cdk.Stack.of(this).formatArn({
        service: 'scheduler',
        resource: 'schedule',
        resourceName: `${reminderScheduleGroup.name}/*`,
      }),
    });

    [createWorkshop.fn, updateWorkshop.fn, deleteWorkshop.fn].forEach((handlerFn) => {
      handlerFn.addEnvironment('REMINDER_SCHEDULE_GROUP', reminderScheduleGroup.name!);
      handlerFn.addEnvironment('REMINDER_TARGET_ARN', reminderTarget.functionArn);
      handlerFn.addEnvironment('REMINDER_SCHEDULE_ROLE_ARN', schedulerInvokeRole.roleArn);
      handlerFn.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'scheduler:CreateSchedule',
          'scheduler:UpdateSchedule',
          'scheduler:DeleteSchedule',
          'scheduler:GetSchedule',
        ],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: 'scheduler',
            resource: 'schedule',
            resourceName: `${reminderScheduleGroup.name}/*`,
          }),
          cdk.Stack.of(this).formatArn({
            service: 'scheduler',
            resource: 'schedule-group',
            resourceName: reminderScheduleGroup.name!,
          }),
        ],
      }));
      handlerFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [schedulerInvokeRole.roleArn],
      }));
    });

    this.lambdaFunctions = handlers.map(handler => handler.fn);
    this.lambdaAliases = handlers
      .map(handler => handler.liveAlias)
      .filter((alias): alias is lambda.Alias => Boolean(alias));

    // ── IAM permissions ───────────────────────────────────────────────────
    const tableReadFns  = [listWorkshops, getWorkshop, listRegistrations, listCerts, verifyCert, registerStudent, listUsers, getUser, issueCert, deleteWorkshop, dispatchReminders, listUserRegistrations].map(handler => handler.fn);
    const tableWriteFns = [createWorkshop, updateWorkshop, deleteWorkshop, registerStudent, unregisterStudent, issueCert, createUser, updateUser, deleteUser, dispatchReminders].map(handler => handler.fn);
    const eventFns      = [createWorkshop, updateWorkshop, deleteWorkshop, registerStudent, unregisterStudent, issueCert, dispatchReminders].map(handler => handler.fn);

    tableReadFns.forEach(f  => props.table.grantReadData(f));
    tableWriteFns.forEach(f => props.table.grantWriteData(f));
    eventFns.forEach(f => {
      f.addToRolePolicy(new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBusArn],
      }));
    });
    [issueCert.fn, listCerts.fn, presignEvidenceUpload.fn, presignEvidenceDownload.fn].forEach(f => props.evidencesBucket.grantReadWrite(f));
    [sendConfirmation.fn, sendReminder.fn, sendCancellation.fn].forEach(f => {
      props.table.grantReadData(f);
      props.appSecret.grantRead(f);
      f.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }));
    });

    handlers.forEach(handler => {
      if (!handler.liveAlias) return;

      const alarmBaseId = handler.fn.functionName
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(-48) || handler.node.id;

      const deploymentAlarm = new cloudwatch.Alarm(this, `${alarmBaseId}DeploymentAlarm`, {
        metric: handler.liveAlias.metricErrors({
          period: cdk.Duration.minutes(1),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `Rollback automático si ${handler.fn.functionName} falla durante el cambio de tráfico`,
      });

      new codedeploy.LambdaDeploymentGroup(this, `${alarmBaseId}DeploymentGroup`, {
        alias: handler.liveAlias,
        deploymentConfig,
        alarms: [deploymentAlarm],
        autoRollback: {
          deploymentInAlarm: true,
          failedDeployment: true,
          stoppedDeployment: true,
        },
      });
    });

    // ── API Gateway ───────────────────────────────────────────────────────
    this.api = new apigateway.RestApi(this, 'FormatonApi', {
      restApiName: `formaton-api-${props.config.envName}`,
      description: 'Formaton LMS — API REST',
      deployOptions: {
        stageName: props.config.envName,
        throttlingRateLimit: props.config.apiThrottlingRateLimit,
        throttlingBurstLimit: props.config.apiThrottlingBurstLimit,
        tracingEnabled: props.config.enableXRay,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: props.config.envName !== 'prod',
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: props.config.envName === 'prod'
          ? (props.config.domainName
              ? [`https://${props.config.domainName}`]
              : ['http://localhost:5173'])
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // ── Cognito Authorizer ────────────────────────────────────────────────
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'FormatonAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'formaton-jwt-authorizer',
    });

    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    const publicOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.NONE,
    };

    const workshopRequestProperties: Record<string, apigateway.JsonSchema> = {
      name: { type: apigateway.JsonSchemaType.STRING, minLength: 3 },
      description: { type: apigateway.JsonSchemaType.STRING },
      category: { type: apigateway.JsonSchemaType.STRING, minLength: 2 },
      mode: { type: apigateway.JsonSchemaType.STRING, enum: ['presencial', 'online', 'hibrida'] },
      location: { type: apigateway.JsonSchemaType.STRING },
      startAt: { type: apigateway.JsonSchemaType.STRING },
      endAt: { type: apigateway.JsonSchemaType.STRING },
      durationHours: { type: apigateway.JsonSchemaType.NUMBER, minimum: 1 },
      capacity: { type: apigateway.JsonSchemaType.NUMBER, minimum: 1 },
      generatesCert: { type: apigateway.JsonSchemaType.BOOLEAN },
      certNorm: { type: apigateway.JsonSchemaType.STRING },
    };

    const workshopModel = new apigateway.Model(this, 'WorkshopRequestModel', {
      restApi: this.api,
      contentType: 'application/json',
      modelName: `WorkshopRequest${props.config.envName}`,
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'WorkshopRequest',
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['name', 'category', 'mode', 'startAt', 'endAt', 'durationHours', 'capacity'],
        additionalProperties: false,
        properties: workshopRequestProperties,
      },
    });

    const workshopPatchModel = new apigateway.Model(this, 'WorkshopPatchRequestModel', {
      restApi: this.api,
      contentType: 'application/json',
      modelName: `WorkshopPatchRequest${props.config.envName}`,
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'WorkshopPatchRequest',
        type: apigateway.JsonSchemaType.OBJECT,
        minProperties: 1,
        additionalProperties: false,
        properties: workshopRequestProperties,
      },
    });

    const requestValidator = new apigateway.RequestValidator(this, 'WorkshopRequestValidator', {
      restApi: this.api,
      requestValidatorName: `formaton-workshop-validator-${props.config.envName}`,
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    const userRequestProperties: Record<string, apigateway.JsonSchema> = {
      email: { type: apigateway.JsonSchemaType.STRING, minLength: 5 },
      givenName: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
      familyName: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
      department: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
      role: { type: apigateway.JsonSchemaType.STRING, enum: ['admin', 'manager', 'student'] },
      active: { type: apigateway.JsonSchemaType.BOOLEAN },
    };

    const userCreateModel = new apigateway.Model(this, 'UserCreateRequestModel', {
      restApi: this.api,
      contentType: 'application/json',
      modelName: `UserCreateRequest${props.config.envName}`,
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'UserCreateRequest',
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['email', 'givenName', 'familyName', 'department'],
        additionalProperties: false,
        properties: userRequestProperties,
      },
    });

    const userPatchModel = new apigateway.Model(this, 'UserPatchRequestModel', {
      restApi: this.api,
      contentType: 'application/json',
      modelName: `UserPatchRequest${props.config.envName}`,
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'UserPatchRequest',
        type: apigateway.JsonSchemaType.OBJECT,
        minProperties: 1,
        additionalProperties: false,
        properties: userRequestProperties,
      },
    });

    const certIssueModel = new apigateway.Model(this, 'CertIssueRequestModel', {
      restApi: this.api,
      contentType: 'application/json',
      modelName: `CertIssueRequest${props.config.envName}`,
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'CertIssueRequest',
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['userId', 'workshopId'],
        additionalProperties: false,
        properties: {
          userId: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
          workshopId: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
          score: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0, maximum: 100 },
          expiresAt: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
        },
      },
    });

    const evidenceUploadModel = new apigateway.Model(this, 'EvidenceUploadRequestModel', {
      restApi: this.api,
      contentType: 'application/json',
      modelName: `EvidenceUploadRequest${props.config.envName}`,
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'EvidenceUploadRequest',
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['fileName', 'contentType'],
        additionalProperties: false,
        properties: {
          fileName: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
          contentType: { type: apigateway.JsonSchemaType.STRING, minLength: 3 },
          folder: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
        },
      },
    });

    const evidenceDownloadModel = new apigateway.Model(this, 'EvidenceDownloadRequestModel', {
      restApi: this.api,
      contentType: 'application/json',
      modelName: `EvidenceDownloadRequest${props.config.envName}`,
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'EvidenceDownloadRequest',
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['fileKey'],
        additionalProperties: false,
        properties: {
          fileKey: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
          downloadName: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
        },
      },
    });

    // ── Routes ────────────────────────────────────────────────────────────
    // GET  /workshops              — público, cacheable
    // GET  /workshops/{id}         — público
    // POST /workshops              — admin
    // PUT  /workshops/{id}         — admin
    // DELETE /workshops/{id}       — admin
    // POST /workshops/{id}/register    — student autenticado
    // DELETE /workshops/{id}/register  — student autenticado
    // GET  /workshops/{id}/registrations — admin

    const workshops = this.api.root.addResource('workshops');
    const health = this.api.root.addResource('healthz');
    health.addMethod('GET', new apigateway.LambdaIntegration(integrationTarget(healthz)), publicOptions);
    workshops.addMethod('GET',  new apigateway.LambdaIntegration(integrationTarget(listWorkshops)),  publicOptions);
    workshops.addMethod('POST', new apigateway.LambdaIntegration(integrationTarget(createWorkshop)), {
      ...authOptions,
      requestValidator,
      requestModels: { 'application/json': workshopModel },
    });

    const workshop = workshops.addResource('{id}');
    workshop.addMethod('GET',    new apigateway.LambdaIntegration(integrationTarget(getWorkshop)),    publicOptions);
    workshop.addMethod('PUT',    new apigateway.LambdaIntegration(integrationTarget(updateWorkshop)), {
      ...authOptions,
      requestValidator,
      requestModels: { 'application/json': workshopPatchModel },
    });
    workshop.addMethod('DELETE', new apigateway.LambdaIntegration(integrationTarget(deleteWorkshop)), authOptions);

    const register = workshop.addResource('register');
    register.addMethod('POST',   new apigateway.LambdaIntegration(integrationTarget(registerStudent)),   authOptions);
    register.addMethod('DELETE', new apigateway.LambdaIntegration(integrationTarget(unregisterStudent)),  authOptions);

    const registrations = workshop.addResource('registrations');
    registrations.addMethod('GET', new apigateway.LambdaIntegration(integrationTarget(listRegistrations)), authOptions);

    const certs = this.api.root.addResource('certs');
    certs.addMethod('GET', new apigateway.LambdaIntegration(integrationTarget(listCerts)), authOptions);
    certs.addResource('issue').addMethod('POST', new apigateway.LambdaIntegration(integrationTarget(issueCert)), {
      ...authOptions,
      requestValidator,
      requestModels: { 'application/json': certIssueModel },
    });

    const cert = certs.addResource('{id}');
    cert.addResource('verify').addMethod('GET', new apigateway.LambdaIntegration(integrationTarget(verifyCert)), publicOptions);

    const users = this.api.root.addResource('users');
    users.addMethod('GET', new apigateway.LambdaIntegration(integrationTarget(listUsers)), authOptions);
    users.addMethod('POST', new apigateway.LambdaIntegration(integrationTarget(createUser)), {
      ...authOptions,
      requestValidator,
      requestModels: { 'application/json': userCreateModel },
    });

    const user = users.addResource('{id}');
    user.addMethod('GET', new apigateway.LambdaIntegration(integrationTarget(getUser)), authOptions);
    user.addMethod('PUT', new apigateway.LambdaIntegration(integrationTarget(updateUser)), {
      ...authOptions,
      requestValidator,
      requestModels: { 'application/json': userPatchModel },
    });
    user.addMethod('DELETE', new apigateway.LambdaIntegration(integrationTarget(deleteUser)), authOptions);
    user.addResource('registrations').addMethod('GET', new apigateway.LambdaIntegration(integrationTarget(listUserRegistrations)), authOptions);

    const evidences = this.api.root.addResource('evidences');
    evidences.addResource('presign-upload').addMethod('POST', new apigateway.LambdaIntegration(integrationTarget(presignEvidenceUpload)), {
      ...authOptions,
      requestValidator,
      requestModels: { 'application/json': evidenceUploadModel },
    });
    evidences.addResource('presign-download').addMethod('POST', new apigateway.LambdaIntegration(integrationTarget(presignEvidenceDownload)), {
      ...authOptions,
      requestValidator,
      requestModels: { 'application/json': evidenceDownloadModel },
    });

    this.apiUrl = this.api.url;

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.api.url, exportName: `formaton-api-url-${props.config.envName}` });
    new cdk.CfnOutput(this, 'ApiId', { value: this.api.restApiId });
  }
}
