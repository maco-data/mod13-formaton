# Día 1 — Checklist Realista

## Objetivo del día

Dejar la base de AWS y del proyecto lista para empezar a provisionar mañana sin perder tiempo en setup.

## Lo que ya queda cubierto en el repo

- `infra/` con AWS CDK en TypeScript
- stacks separados: `Auth`, `Data`, `Events`, `Api`, `Front`, `Observability`
- contrato mínimo de API en [docs/api-contract.md](./api-contract.md)
- guía de despliegue en [docs/deployment.md](./deployment.md)

## Tareas manuales pendientes en AWS

1. Reautenticar CLI:
   - `aws login`
   - comprobar con `aws sts get-caller-identity`

2. Confirmar región de trabajo:
   - `eu-west-1`

3. Activar presupuesto mensual:
   - seguir el comando del paso 5 en [docs/deployment.md](./deployment.md)
   - recomendación para dev: `5 USD` o `10 USD`

4. Verificar bootstrap de CDK:
   - `cd infra`
   - `cdk bootstrap aws://<ACCOUNT_ID>/eu-west-1`

## Validaciones locales que deben pasar

- `npm --workspace=backend run build`
- `npm --workspace=infra run build`
- `npm --workspace=infra run synth -- --context env=dev`

## Decisiones de arquitectura ya tomadas

- IaC: AWS CDK con TypeScript
- API: API Gateway REST
- Auth: Cognito User Pool
- Data: DynamoDB single-table + S3 privado para evidencias
- Eventos: EventBridge + DLQ
- Front: S3 privado + CloudFront
- Observabilidad: CloudWatch + alarmas + X-Ray

## Lo que se hará mañana

- provisionar `AuthStack` y `DataStack`
- crear usuario admin inicial
- preparar datos de prueba mínimos
