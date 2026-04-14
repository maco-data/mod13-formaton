import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';

interface AuthStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    // ── User Pool ─────────────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'FormatonUserPool', {
      userPoolName: `formaton-users-${props.config.envName}`,
      selfSignUpEnabled: false,           // RR.HH. invita manualmente
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      customAttributes: {
        department: new cognito.StringAttribute({ mutable: true }),
        role: new cognito.StringAttribute({ mutable: true }), // admin | manager | student
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.config.envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // ── Groups (roles) ────────────────────────────────────────────────────
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
      description: 'Administradores de formación (RR.HH.)',
    });
    new cognito.CfnUserPoolGroup(this, 'ManagerGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'manager',
      description: 'Responsables de área',
    });
    new cognito.CfnUserPoolGroup(this, 'StudentGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'student',
      description: 'Participantes en formaciones',
    });

    // ── App Client ────────────────────────────────────────────────────────
    const client = new cognito.UserPoolClient(this, 'FormatonWebClient', {
      userPool: this.userPool,
      userPoolClientName: `formaton-web-${props.config.envName}`,
      authFlows: {
        userSrp: true,
        userPassword: props.config.envName !== 'prod',
        adminUserPassword: props.config.envName !== 'prod',
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: props.config.domainName
          ? [`https://${props.config.domainName}/callback`]
          : ['http://localhost:5173/callback'],
        logoutUrls: props.config.domainName
          ? [`https://${props.config.domainName}/logout`]
          : ['http://localhost:5173/logout'],
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    this.userPoolClientId = client.userPoolClientId;

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId, exportName: `formaton-user-pool-id-${props.config.envName}` });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClientId, exportName: `formaton-client-id-${props.config.envName}` });
    new cdk.CfnOutput(this, 'UserPoolArn', { value: this.userPool.userPoolArn });
  }
}
