import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';
import { FormatonLambda } from '../constructs/lambda-construct';

interface ApiStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
  userPool: cognito.UserPool;
  table: dynamodb.Table;
  evidencesBucket: s3.Bucket;
  eventBus: events.EventBus;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiUrl: string;
  public readonly lambdaFunctions: lambda.Function[];

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    // ── Shared Lambda environment ─────────────────────────────────────────
    const sharedEnv = {
      TABLE_NAME: props.table.tableName,
      EVIDENCES_BUCKET: props.evidencesBucket.bucketName,
      EVENT_BUS_NAME: props.eventBus.eventBusName,
      ENV: props.config.envName,
      LOG_LEVEL: props.config.envName === 'prod' ? 'WARN' : 'DEBUG',
    };

    // ── Lambda factory helper ─────────────────────────────────────────────
    const fn = (id: string, handler: string, description: string) =>
      new FormatonLambda(this, id, {
        handler,
        description,
        environment: sharedEnv,
        reservedConcurrentExecutions: props.config.lambdaReservedConcurrency,
        enableXRay: props.config.enableXRay,
      }).fn;

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
    const sendConfirmation    = fn('SendConfirmation',    'handlers/notifications/send-confirmation.handler', 'Notificación de inscripción');
    const sendReminder        = fn('SendReminder',        'handlers/notifications/send-reminder.handler',    'Recordatorio 24h antes');

    this.lambdaFunctions = [
      listWorkshops, getWorkshop, createWorkshop, updateWorkshop, deleteWorkshop,
      registerStudent, unregisterStudent, listRegistrations,
      issueCert, listCerts, verifyCert,
      listUsers, getUser, createUser,
      sendConfirmation, sendReminder,
    ];

    // ── IAM permissions ───────────────────────────────────────────────────
    const tableReadFns  = [listWorkshops, getWorkshop, listRegistrations, listCerts, verifyCert, registerStudent, listUsers, getUser];
    const tableWriteFns = [createWorkshop, updateWorkshop, deleteWorkshop, registerStudent, unregisterStudent, issueCert, createUser];
    const eventFns      = [createWorkshop, updateWorkshop, deleteWorkshop, registerStudent, unregisterStudent, issueCert];

    tableReadFns.forEach(f  => props.table.grantReadData(f));
    tableWriteFns.forEach(f => props.table.grantWriteData(f));
    eventFns.forEach(f      => props.eventBus.grantPutEventsTo(f));
    [issueCert, listCerts].forEach(f => props.evidencesBucket.grantReadWrite(f));
    [sendConfirmation, sendReminder].forEach(f => {
      f.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }));
    });

    // ── EventBridge rules ─────────────────────────────────────────────────
    new events.Rule(this, 'StudentRegisteredRule', {
      eventBus: props.eventBus,
      description: 'Dispara la notificación de confirmación al registrarse un estudiante',
      eventPattern: {
        source: ['formaton.app'],
        detailType: ['student.registered'],
      },
      targets: [new targets.LambdaFunction(sendConfirmation)],
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
        allowOrigins: props.config.domainName
          ? [`https://${props.config.domainName}`]
          : ['http://localhost:5173'],
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
    workshops.addMethod('GET',  new apigateway.LambdaIntegration(listWorkshops),  publicOptions);
    workshops.addMethod('POST', new apigateway.LambdaIntegration(createWorkshop), authOptions);

    const workshop = workshops.addResource('{id}');
    workshop.addMethod('GET',    new apigateway.LambdaIntegration(getWorkshop),    publicOptions);
    workshop.addMethod('PUT',    new apigateway.LambdaIntegration(updateWorkshop), authOptions);
    workshop.addMethod('DELETE', new apigateway.LambdaIntegration(deleteWorkshop), authOptions);

    const register = workshop.addResource('register');
    register.addMethod('POST',   new apigateway.LambdaIntegration(registerStudent),   authOptions);
    register.addMethod('DELETE', new apigateway.LambdaIntegration(unregisterStudent),  authOptions);

    const registrations = workshop.addResource('registrations');
    registrations.addMethod('GET', new apigateway.LambdaIntegration(listRegistrations), authOptions);

    const certs = this.api.root.addResource('certs');
    certs.addMethod('GET', new apigateway.LambdaIntegration(listCerts), authOptions);
    certs.addResource('issue').addMethod('POST', new apigateway.LambdaIntegration(issueCert), authOptions);

    const cert = certs.addResource('{id}');
    cert.addResource('verify').addMethod('GET', new apigateway.LambdaIntegration(verifyCert), publicOptions);

    const users = this.api.root.addResource('users');
    users.addMethod('GET', new apigateway.LambdaIntegration(listUsers), authOptions);
    users.addMethod('POST', new apigateway.LambdaIntegration(createUser), authOptions);

    const user = users.addResource('{id}');
    user.addMethod('GET', new apigateway.LambdaIntegration(getUser), authOptions);

    this.apiUrl = this.api.url;

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.api.url, exportName: `formaton-api-url-${props.config.envName}` });
    new cdk.CfnOutput(this, 'ApiId', { value: this.api.restApiId });
  }
}
