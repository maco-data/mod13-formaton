# Formaton — Guía de despliegue

## Pre-requisitos

1. **Node.js** ≥ 20.x
2. **AWS CLI** configurado: `aws configure` (perfil con permisos de administrador para el bootstrap)
3. **CDK v2**: `npm install -g aws-cdk`
4. Cuenta AWS con presupuesto configurado (ver paso 5)

---

## 1. Clonar e instalar

```bash
git clone https://github.com/tuempresa/formaton.git
cd formaton
npm run install:all
```

---

## 2. Bootstrap CDK (solo la primera vez por cuenta/región)

```bash
cd infra
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/eu-west-1
```

---

## 3. Configurar entorno

Editar `infra/config/environments.ts`:
- Actualizar `domainName`, `hostedZoneName` y `hostedZoneId` para producción.
- Ajustar `wafRateLimit` si el tráfico esperado en producción requiere un umbral distinto.

Crear `.env.local` en `frontend/` (ver `.env.example`).

---

## 4. Desplegar en Dev

```bash
npm run deploy:dev
# equivale a: cd infra && cdk deploy --all --context env=dev
```

Orden de despliegue automático:
1. `Formaton-Auth-dev`
2. `Formaton-Data-dev`
3. `Formaton-Events-dev`
4. `Formaton-Api-dev`
5. `Formaton-Front-dev`
6. `Formaton-Observability-dev`

Al finalizar, CDK imprime los **outputs** clave:
```
Formaton-Auth-dev.UserPoolId       = eu-west-1_XXXXXXX
Formaton-Auth-dev.UserPoolClientId = xxxxxxxxxxxxxxxxx
Formaton-Api-dev.ApiUrl            = https://xxxxx.execute-api.eu-west-1.amazonaws.com/dev/
Formaton-Front-dev.DistributionUrl = https://xxxx.cloudfront.net
```

En local, usar `VITE_API_URL=/api` para que el frontend pase por CloudFront y quede cubierto por el WAF del edge.

---

## 5. Configurar presupuesto AWS (obligatorio)

```bash
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{
    "BudgetName": "formaton-monthly",
    "BudgetLimit": {"Amount": "50", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "ops@tuempresa.es"}]
  }]'
```

---

## 6. Build y deploy del frontend

```bash
cd frontend
cp .env.example .env.local   # rellenar con outputs del paso 4
npm run build
# subir dist/ al bucket S3 e invalidar CloudFront:
aws s3 sync dist/ s3://$(aws cloudformation describe-stacks \
  --stack-name Formaton-Front-dev \
  --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue" \
  --output text) --delete
aws cloudfront create-invalidation \
  --distribution-id $(aws cloudformation describe-stacks \
    --stack-name Formaton-Front-dev \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text) \
  --paths "/*"
```

---

## 7. Desplegar en Producción

```bash
# Crear tag de release → GitHub Actions lo despliega con aprobación manual
git tag v1.0.0 && git push --tags

# O manualmente:
cd infra && cdk deploy --all --context env=prod --require-approval broadening
```

El despliegue de Lambdas usa alias `live` y CodeDeploy:
- `dev`: canary progresivo
- `prod`: lineal al 10% por minuto con rollback automático si aparece una alarma de errores

Puedes verificar localmente que el rollback por alarma sigue cableado tras sintetizar:

```bash
cd infra
CDK_DEFAULT_ACCOUNT=123456789012 CDK_DEFAULT_REGION=eu-west-1 npx cdk synth --context env=dev --quiet
npm run verify:blue-green:dev

CDK_DEFAULT_ACCOUNT=123456789012 CDK_DEFAULT_REGION=eu-west-1 npx cdk synth --context env=prod --quiet
npm run verify:blue-green:prod
```

El frontend de `prod` crea además:
- certificado ACM en `us-east-1` validado por DNS
- registros `A` y `AAAA` en Route 53 apuntando a CloudFront
- salida `CustomDomainUrl` para validar el dominio final

---

## 8. Crear primer usuario administrador

```bash
# Crear usuario en Cognito
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username admin@tuempresa.es \
  --user-attributes Name=email,Value=admin@tuempresa.es Name=given_name,Value=Admin Name=family_name,Value=Formaton \
  --temporary-password "Formaton2026!" \
  --message-action SUPPRESS

# Añadir al grupo admin
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <UserPoolId> \
  --username admin@tuempresa.es \
  --group-name admin
```

---

## 9. Verificar el despliegue

```bash
# Smoke test: listar talleres (endpoint público estable usado también en CI)
curl -s https://<ApiUrl>/workshops | jq '.count'

# Verificar distribución CloudFront
curl -I https://<DistributionUrl>

# Verificar proxy API a través de CloudFront (camino protegido por WAF)
curl -s https://<DistributionUrl>/api/healthz
```

En CI el smoke test post-deploy valida algo más fuerte que un `200`:
- la respuesta de API Gateway y la de CloudFront deben ser JSON válido
- deben incluir `items[]` y `count`
- `count` debe coincidir con `items.length`
- ambas rutas deben devolver la misma lista para `limit=1`

---

## Rollback

```bash
# Ver historial de changesets
aws cloudformation describe-stack-events --stack-name Formaton-Api-dev

# Revertir stack concreto a versión anterior
cdk deploy Formaton-Api-dev --context env=dev --rollback
```

---

## Destruir entorno Dev (¡cuidado!)

```bash
cd infra && cdk destroy --all --context env=dev --force
```

> Los stacks de Prod tienen `RemovalPolicy.RETAIN` en DynamoDB y S3, por lo que los datos persisten aunque se destruya el stack.
