export interface EnvConfig {
  envName: string;
  region: string;
  domainName?: string;
  hostedZoneId?: string;
  logRetentionDays: number;
  lambdaReservedConcurrency?: number;
  apiThrottlingRateLimit: number;
  apiThrottlingBurstLimit: number;
  enableWaf: boolean;
  enableXRay: boolean;
  enableBlueGreenDeployments: boolean;
  wafRateLimit: number;
  dynamoTableClass: 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS';
}

const defaults: Omit<EnvConfig, 'envName'> = {
  region: 'eu-west-1',
  logRetentionDays: 30,
  lambdaReservedConcurrency: 10,
  apiThrottlingRateLimit: 100,
  apiThrottlingBurstLimit: 50,
  enableWaf: false,
  enableXRay: true,
  enableBlueGreenDeployments: true,
  wafRateLimit: 1000,
  dynamoTableClass: 'STANDARD',
};

const configs: Record<string, EnvConfig> = {
  dev: {
    ...defaults,
    envName: 'dev',
    lambdaReservedConcurrency: undefined,
    enableWaf: false,
  },
  prod: {
    ...defaults,
    envName: 'prod',
    domainName: 'formaton.tuempresa.es',        // ← actualizar
    hostedZoneId: 'ZXXXXXXXXXXXXX',             // ← actualizar
    logRetentionDays: 90,
    lambdaReservedConcurrency: 50,
    apiThrottlingRateLimit: 1000,
    apiThrottlingBurstLimit: 500,
    enableWaf: true,
    wafRateLimit: 2000,
    dynamoTableClass: 'STANDARD',
  },
};

export function getEnvConfig(envName: string): EnvConfig {
  const config = configs[envName];
  if (!config) throw new Error(`Unknown environment: "${envName}". Valid: ${Object.keys(configs).join(', ')}`);
  return config;
}
