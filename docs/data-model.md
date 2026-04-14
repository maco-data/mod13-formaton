# Formaton — Modelo de Datos (DynamoDB Single-Table)

## Tabla: `formaton-{env}`

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `PK` | String | Partition Key principal |
| `SK` | String | Sort Key principal |
| `GSI1PK` | String | Partition Key del índice global 1 |
| `GSI1SK` | String | Sort Key del índice global 1 |
| `GSI2PK` | String | Partition Key del índice global 2 |
| `GSI2SK` | String | Sort Key del índice global 2 |
| `ttl` | Number | TTL Unix timestamp (para expirar ítems temporales) |

---

## Índices Secundarios Globales

### GSI1 — Listado de talleres por fecha / inscripciones por usuario
- `GSI1PK` + `GSI1SK`
- Proyección: ALL

### GSI2 — Talleres por categoría
- `GSI2PK` + `GSI2SK`
- Proyección: ALL

---

## Patrones de ítem

### Taller (Workshop)
```
PK  = WORKSHOP#<uuid>
SK  = META
GSI1PK = WORKSHOP#ALL
GSI1SK = <startAt ISO>          ← ordena por fecha
GSI2PK = CATEGORY#<category>
GSI2SK = <startAt ISO>
```

Atributos: `id, name, description, category, mode, location, startAt, endAt, durationHours, capacity, enrolledCount, status, generatesCert, certNorm, instructorId, createdAt, updatedAt`

---

### Inscripción (Registration)
```
PK  = WORKSHOP#<workshopId>
SK  = REG#USER#<userId>
GSI1PK = USER#<userId>
GSI1SK = REG#<workshopId>       ← talleres de un usuario
```

Atributos: `workshopId, userId, status, registeredAt, completedAt, score, attended, certIssued, certId`

---

### Usuario (User)
```
PK  = USER#<cognitoSub>
SK  = META
```

Atributos: `id, email, givenName, familyName, fullName, department, role, active, createdAt, updatedAt`

---

### Certificado (Cert)
```
PK  = USER#<userId>
SK  = CERT#<certId>
GSI1PK = CERT#<certId>
GSI1SK = <issuedAt ISO>         ← verificación pública por certId
```

Atributos: `certId, userId, workshopId, workshopName, norm, issuedAt, expiresAt, status, fileKey, score`

---

## Patrones de acceso cubiertos

| Operación | Clave de acceso | Índice |
|-----------|----------------|--------|
| Detalle de taller | PK=`WORKSHOP#<id>`, SK=`META` | Tabla principal |
| Inscritos de un taller | PK=`WORKSHOP#<id>`, SK begins_with `REG#USER#` | Tabla principal |
| Listado de talleres por fecha | GSI1PK=`WORKSHOP#ALL` | GSI1 |
| Talleres por categoría | GSI2PK=`CATEGORY#<cat>` | GSI2 |
| Talleres de un usuario | GSI1PK=`USER#<id>`, GSI1SK begins_with `REG#` | GSI1 |
| Perfil de usuario | PK=`USER#<id>`, SK=`META` | Tabla principal |
| Certificados de un usuario | PK=`USER#<id>`, SK begins_with `CERT#` | Tabla principal |
| Verificar certificado por ID | GSI1PK=`CERT#<certId>` | GSI1 |

---

## Notas de diseño

- **Single-table design**: todos los tipos de ítem en una tabla minimiza costes y latencia.
- **enrolledCount** se incrementa/decrementa con `UpdateExpression` atómica para evitar race conditions en inscripciones simultáneas.
- **Idempotencia en inscripciones**: se comprueba existencia de `REG#USER#<id>` antes de escribir.
- **Soft-delete en talleres**: `status = cancelled` en lugar de `DeleteItem`, preserva el histórico.
- **TTL** disponible para limpiar ítems de auditoría o sesiones temporales.
- Para escenarios de alta concurrencia en inscripciones (>100 simultáneas), considerar DynamoDB Transactions o un mecanismo de cola (SQS → Lambda).
