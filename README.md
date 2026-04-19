# Formaton — Plataforma de Gestión de Formación

Sistema LMS corporativo serverless construido sobre AWS con CDK (TypeScript).

## Estado actual

- Entorno `dev` desplegado end-to-end en AWS
- Frontend publicado en CloudFront
- API Gateway + Lambda conectados a DynamoDB
- Cognito operativo con roles `admin`, `manager` y `student`
- EventBridge activo para eventos de negocio
- Alarmas y dashboard en CloudWatch
- CI/CD básico con GitHub Actions

## Demo dev

- Frontend: `https://d3dvjbhouf9kz8.cloudfront.net`
- API: `https://lvkm9fye6g.execute-api.eu-west-1.amazonaws.com/dev/`
- Admin demo: `admin@formaton.demo`
- Student demo: `student@formaton.demo`
- Password demo: `Formaton2026!`

## Estructura del proyecto

```
formaton/
├── infra/          → Infraestructura AWS CDK (IaC)
├── backend/        → Lambdas y lógica de negocio (TypeScript)
├── frontend/       → SPA React (Vite + TypeScript)
└── docs/           → Documentación técnica
```

## Stacks CDK

| Stack | Responsabilidad |
|---|---|
| `AuthStack` | Cognito User Pool, App Client, Hosted UI |
| `DataStack` | DynamoDB tabla única + GSIs, S3 evidencias |
| `EventsStack` | EventBridge bus, reglas, Scheduler, SQS DLQ |
| `SecretStack` | Secrets Manager para configuración sensible de notificaciones |
| `ApiStack` | API Gateway REST, Lambdas, CodeDeploy blue/green |
| `FrontStack` | S3 hosting, CloudFront OAC, ACM, WAF, Route 53 |
| `ObservabilityStack` | CloudWatch Logs/Metrics/Alarms, X-Ray, Dashboards |
| `BudgetStack` | AWS Budgets mensual con alertas por e-mail |

## Requisitos

- Node.js ≥ 20
- AWS CDK v2 (`npm i -g aws-cdk`)
- AWS CLI configurado (`aws configure`)

## Inicio rápido

```bash
# 1. Instalar dependencias
npm run install:all

# 2. Bootstrapear la cuenta AWS (solo primera vez)
cd infra && cdk bootstrap aws://ACCOUNT_ID/eu-west-1

# 3. Desplegar en dev
npm run deploy:dev

# 4. Desplegar en prod (requiere aprobación manual)
npm run deploy:prod
```

## Variables de entorno

Ver `frontend/.env.example`, `frontend/.env.local` y `infra/config/environments.ts`.

Para presupuestos, ajustar por entorno:
- `budgetMonthlyUsd`
- `budgetAlertThresholdPct`
- `budgetAlertEmails`

## CI/CD

Pipeline GitHub Actions: `.github/workflows/ci-cd.yml`
- Push a `dev` → deploy automático a dev
- Tag `v*.*.*` → deploy a prod con aprobación manual
