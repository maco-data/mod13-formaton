import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';

interface SecretStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
}

export class SecretStack extends cdk.Stack {
  public readonly appSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: SecretStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    this.appSecret = new secretsmanager.Secret(this, 'AppConfigSecret', {
      secretName: `formaton/app-config/${props.config.envName}`,
      description: 'Configuración sensible de Formaton para notificaciones e integraciones',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          sesFromAddress: props.config.notificationFromEmail,
          notificationWebhookUrl: '',
        }),
        generateStringKey: 'appKey',
        excludePunctuation: true,
      },
    });

    new cdk.CfnOutput(this, 'AppSecretArn', {
      value: this.appSecret.secretArn,
      exportName: `formaton-app-secret-arn-${props.config.envName}`,
    });
    new cdk.CfnOutput(this, 'AppSecretName', {
      value: this.appSecret.secretName,
      exportName: `formaton-app-secret-name-${props.config.envName}`,
    });
  }
}
