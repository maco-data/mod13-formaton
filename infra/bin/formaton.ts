#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { EventsStack } from '../lib/stacks/events-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontStack } from '../lib/stacks/front-stack';
import { ObservabilityStack } from '../lib/stacks/observability-stack';
import { getEnvConfig } from '../config/environments';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'dev';
const config = getEnvConfig(envName);

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: config.region,
};

const tags = {
  Project: 'Formaton',
  Env: envName,
  ManagedBy: 'CDK',
};

// ── Stacks (orden de dependencia) ──────────────────────────────────────────
const authStack = new AuthStack(app, `Formaton-Auth-${envName}`, { env, config, tags });

const dataStack = new DataStack(app, `Formaton-Data-${envName}`, { env, config, tags });

const eventsStack = new EventsStack(app, `Formaton-Events-${envName}`, { env, config, tags });

const apiStack = new ApiStack(app, `Formaton-Api-${envName}`, {
  crossRegionReferences: config.envName === 'prod',
  env, config, tags,
  userPool: authStack.userPool,
  table: dataStack.table,
  evidencesBucket: dataStack.evidencesBucket,
  eventBus: eventsStack.eventBus,
});

const frontStack = new FrontStack(app, `Formaton-Front-${envName}`, {
  crossRegionReferences: config.envName === 'prod',
  env: { ...env, region: config.envName === 'prod' ? 'us-east-1' : config.region },
  config,
  tags,
  apiUrl: apiStack.apiUrl,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClientId,
});

new ObservabilityStack(app, `Formaton-Observability-${envName}`, {
  env, config, tags,
  api: apiStack.api,
  lambdaFunctions: apiStack.lambdaFunctions,
  table: dataStack.table,
});

app.synth();
