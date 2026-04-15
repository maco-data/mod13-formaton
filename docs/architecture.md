# Formaton — Arquitectura de Referencia

## Visión general

Plataforma LMS serverless 100% AWS, diseñada para equipos de RR.HH. que gestionan formaciones corporativas, certificaciones normativas y cumplimiento Fundae/ISO.

```
Usuario (browser)
       │
       ▼
  Route 53 (DNS)
       │
       ▼
  CloudFront (CDN + WAF)
  ├── /           → S3 (frontend React)
  └── /api/*      → API Gateway REST
                        │
                  Cognito Authorizer (JWT)
                        │
                  ┌─────┴──────┐
                  │   Lambdas  │
                  └─────┬──────┘
                        │
              ┌─────────┼──────────┐
              ▼         ▼          ▼
          DynamoDB     S3      EventBridge
        (single-table) (evidencias) (bus)
                                   │
                         ┌─────────┼──────────┐
                         ▼         ▼          ▼
                     Lambda     Lambda    Scheduler
                  (confirm)  (reminder)   (24h)
                         │         │
                        SES       SES
                     (email)   (email)
```

---

## Stacks CDK

### AuthStack (`infra/lib/stacks/auth-stack.ts`)
- **Cognito User Pool**: signup desactivado, invitación por admin
- **Grupos**: `admin`, `manager`, `student`
- **App Client**: flujo SRP + OAuth Authorization Code
- **Tokens**: idToken 1h, refreshToken 30d

### DataStack (`infra/lib/stacks/data-stack.ts`)
- **DynamoDB**: tabla única con diseño PK/SK + 2 GSIs
- **S3 evidencias**: bucket privado, versionado en prod, lifecycle → Intelligent-Tiering 90d
- **PITR**: activado en producción

### EventsStack (`infra/lib/stacks/events-stack.ts`)
- **EventBridge custom bus**: `formaton-events-{env}`
- **Regla activa**: `student.registered` → Lambda `send-confirmation`
- **Archive**: 90 días en producción para replay
- **SQS DLQ**: retención 14 días para mensajes fallidos

### ApiStack (`infra/lib/stacks/api-stack.ts`)
- **API Gateway REST** con stage por entorno
- **Cognito Authorizer** en todas las rutas protegidas
- **Lambdas Node.js 20.x** con alias `live`, X-Ray, reserva de concurrencia y despliegue progresivo con CodeDeploy
- **Eventos de dominio** publicados en EventBridge (`workshop.created`, `student.registered`)
- **IAM least-privilege**: cada Lambda solo accede a lo que necesita
- **CORS**: configurado por dominio

### FrontStack (`infra/lib/stacks/front-stack.ts`)
- **S3**: hosting privado (sin static website endpoint)
- **CloudFront OAC**: acceso seguro al bucket
- **Behaviors**: `/api/*` → API Gateway con reescritura de path y `/*` → S3
- **SPA fallback**: 403/404 → `index.html`
- **ACM**: certificado TLS en `us-east-1`
- **WAF v2** en prod con reglas AWS managed + rate limiting por IP
- **Despliegue dev**: frontend activo en CloudFront

### ObservabilityStack (`infra/lib/stacks/observability-stack.ts`)
- **CloudWatch Alarms**: 5XX API, latencia P95, errores Lambda, throttles
- **Dashboard**: TPS, latencia, errores, DynamoDB R/W
- **SNS topic**: alertas por email a ops
- **X-Ray**: trazabilidad end-to-end API GW → Lambda → DDB

---

## Seguridad

| Capa | Mecanismo |
|------|-----------|
| Red | CloudFront WAF v2 en prod (rate-based + managed rules de IP reputation, common, bad inputs y SQLi) |
| Autenticación | Cognito JWT (SRP flow) |
| Autorización | API GW Cognito Authorizer + grupos Cognito en handler |
| Datos en tránsito | TLS 1.2+ obligatorio (CloudFront + API GW) |
| Datos en reposo | DynamoDB AWS-managed encryption, S3 SSE-S3 |
| Secretos | Secrets Manager (credenciales externas si aplica) |
| IAM | Roles mínimos por Lambda, sin `*` en recursos |
| CORS | Dominios explícitos, no `*` en producción |

---

## Costes estimados (dev, tráfico bajo)

| Servicio | Estimación mensual |
|----------|--------------------|
| Lambda | ~$0 (free tier 1M invocaciones) |
| API Gateway | ~$0–1 (<1M requests) |
| DynamoDB on-demand | ~$0–2 (tráfico bajo) |
| S3 | ~$0.02 |
| CloudFront | ~$0–1 |
| Cognito | ~$0 (<50K MAU free) |
| CloudWatch | ~$1–3 |
| **Total estimado dev** | **~$2–7/mes** |

> Prod con tráfico real: escalar estimación según MAU y requests/mes. Activar AWS Budgets con alerta al 80% del presupuesto.

---

## CI/CD

```
feature branch → PR → main
                        │
                  GitHub Actions
                  ├── lint + test (backend)
                  ├── cdk synth (validar IaC)
                  ├── build frontend
                  └── deploy dev (auto)

tag v*.*.* → prod pipeline
              ├── mismos pasos
              └── deploy prod (aprobación manual requerida)
```
