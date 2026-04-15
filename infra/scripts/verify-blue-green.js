#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envName = process.argv[2] ?? 'dev';
const templatePath = path.join(__dirname, '..', 'cdk.out', `Formaton-Api-${envName}.template.json`);

if (!fs.existsSync(templatePath)) {
  console.error(`No se encontró la plantilla sintetizada: ${templatePath}`);
  process.exit(1);
}

const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
const resources = template.Resources ?? {};

const aliases = Object.entries(resources).filter(([, resource]) => resource.Type === 'AWS::Lambda::Alias');
const deploymentGroups = Object.entries(resources).filter(([, resource]) => resource.Type === 'AWS::CodeDeploy::DeploymentGroup');
const alarms = Object.entries(resources).filter(([, resource]) => resource.Type === 'AWS::CloudWatch::Alarm');

if (aliases.length === 0) {
  console.error('No hay aliases de Lambda; blue/green no está activo.');
  process.exit(1);
}

if (deploymentGroups.length === 0) {
  console.error('No hay DeploymentGroups de CodeDeploy; blue/green no está configurado.');
  process.exit(1);
}

if (alarms.length === 0) {
  console.error('No hay CloudWatch Alarms sintetizadas para rollback.');
  process.exit(1);
}

const expectedDeploymentConfig =
  envName === 'prod'
    ? 'CodeDeployDefault.LambdaLinear10PercentEvery1Minute'
    : 'CodeDeployDefault.LambdaCanary10Percent5Minutes';

for (const [logicalId, deploymentGroup] of deploymentGroups) {
  const props = deploymentGroup.Properties ?? {};
  const autoRollbackEvents = props.AutoRollbackConfiguration?.Events ?? [];
  const alarmConfig = props.AlarmConfiguration ?? {};
  const deploymentConfigName = props.DeploymentConfigName;

  if (!Array.isArray(autoRollbackEvents) || autoRollbackEvents.length === 0) {
    console.error(`${logicalId}: falta AutoRollbackConfiguration.`);
    process.exit(1);
  }

  const requiredEvents = [
    'DEPLOYMENT_FAILURE',
    'DEPLOYMENT_STOP_ON_ALARM',
    'DEPLOYMENT_STOP_ON_REQUEST',
  ];

  for (const event of requiredEvents) {
    if (!autoRollbackEvents.includes(event)) {
      console.error(`${logicalId}: falta evento de rollback ${event}.`);
      process.exit(1);
    }
  }

  if (!alarmConfig.Enabled || !Array.isArray(alarmConfig.Alarms) || alarmConfig.Alarms.length === 0) {
    console.error(`${logicalId}: falta AlarmConfiguration con alarmas asociadas.`);
    process.exit(1);
  }

  if (typeof deploymentConfigName !== 'string' || !deploymentConfigName.includes(expectedDeploymentConfig)) {
    console.error(`${logicalId}: deployment config inesperado (${deploymentConfigName ?? 'undefined'}).`);
    process.exit(1);
  }
}

console.log(`Blue/green verificado para ${envName}.`);
console.log(`Aliases: ${aliases.length}`);
console.log(`DeploymentGroups: ${deploymentGroups.length}`);
console.log(`Alarms: ${alarms.length}`);
