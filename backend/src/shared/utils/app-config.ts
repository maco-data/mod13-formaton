type AwsSecretsManager = {
  SecretsManager: new () => {
    getSecretValue(params: { SecretId: string }): { promise(): Promise<{ SecretString?: string }> };
  };
};

type AppConfig = {
  sesFromAddress?: string;
  notificationWebhookUrl?: string;
  appKey?: string;
};

let cachedConfig: AppConfig | null = null;

function loadAwsSdk(): AwsSecretsManager {
  return require('aws-sdk') as AwsSecretsManager;
}

export async function getAppConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;

  const secretId = process.env.APP_CONFIG_SECRET_ID;
  if (!secretId) {
    cachedConfig = {};
    return cachedConfig;
  }

  const { SecretsManager } = loadAwsSdk();
  const client = new SecretsManager();
  const response = await client.getSecretValue({ SecretId: secretId }).promise();
  const secretString = response.SecretString;

  if (!secretString) {
    cachedConfig = {};
    return cachedConfig;
  }

  cachedConfig = JSON.parse(secretString) as AppConfig;
  return cachedConfig;
}

export async function getSesFromAddress(): Promise<string> {
  const config = await getAppConfig();
  return config.sesFromAddress ?? process.env.SES_FROM ?? 'formaton@tuempresa.es';
}
