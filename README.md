# Formaton — Plataforma de Gestión de Formación

Sistema LMS corporativo serverless construido sobre AWS con CDK (TypeScript).

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
| `ApiStack` | API Gateway REST, Lambdas, CodeDeploy blue/green |
| `FrontStack` | S3 hosting, CloudFront OAC, ACM, WAF, Route 53 |
| `ObservabilityStack` | CloudWatch Logs/Metrics/Alarms, X-Ray, Dashboards |

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

Ver `frontend/.env.example` y `infra/config/environments.ts`.

## CI/CD

Pipeline GitHub Actions: `.github/workflows/` (por implementar)
- Push a `dev` → deploy automático a dev
- Tag `v*.*.*` → deploy a prod con aprobación manual
