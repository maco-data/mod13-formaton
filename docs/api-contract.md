# Formaton — Contrato de API

## Base URL

| Entorno | URL |
|---------|-----|
| Dev | `https://<api-id>.execute-api.eu-west-1.amazonaws.com/dev` |
| Prod | `https://formaton.tuempresa.es/api` (vía CloudFront) |

## Autenticación

Rutas protegidas requieren header:
```
Authorization: Bearer <Cognito idToken>
```

Rutas públicas: sin cabecera de autorización.

---

## Talleres (Workshops)

### `GET /workshops` — Público
Lista de talleres, paginada.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `limit` | number | Máximo de resultados (1–100, default: 20) |
| `nextToken` | string | Token de paginación (base64 de LastEvaluatedKey) |
| `category` | string | Filtrar por categoría |
| `status` | string | Filtrar por estado: `scheduled\|in_progress\|completed\|cancelled` |

**Respuesta 200:**
```json
{
  "items": [ ...Workshop[] ],
  "count": 2,
  "nextToken": "eyJQSyI6..."
}
```

---

### `GET /workshops/{id}` — Público
Detalle de un taller.

**Respuesta 200:** `Workshop`
**Respuesta 404:** `{ "type": "...", "title": "NOT_FOUND", "status": 404, "detail": "Workshop no encontrado" }`

---

### `POST /workshops` — Admin
Crea un nuevo taller.

Validaciones de negocio:
- `mode` debe ser `presencial`, `online` o `hibrida`
- `startAt` debe ser anterior a `endAt`
- `durationHours` debe ser mayor que `0`
- `capacity` debe ser un entero mayor que `0`
- `location` es obligatoria cuando `mode` es `presencial` o `hibrida`

**Body:**
```json
{
  "name": "PRL Nivel Básico",
  "description": "Formación obligatoria en prevención de riesgos.",
  "category": "Prevención",
  "mode": "presencial",
  "location": "Sala A — Planta 2",
  "startAt": "2026-05-10T09:00:00Z",
  "endAt": "2026-05-10T17:00:00Z",
  "durationHours": 8,
  "capacity": 25,
  "generatesCert": true,
  "certNorm": "Ley 31/1995"
}
```

**Respuesta 201:** `Workshop` creado.

---

### `PUT /workshops/{id}` — Admin
Actualiza campos del taller (parcial).

**Body:** cualquier subconjunto de campos de `POST /workshops`.
Mantiene las mismas validaciones que `POST /workshops` y además impide dejar `capacity` por debajo de `enrolledCount`.
**Respuesta 200:** `Workshop` actualizado.

---

### `DELETE /workshops/{id}` — Admin
Cancela el taller (soft-delete → status: "cancelled").

**Respuesta 204:** Sin cuerpo.
**Respuesta 409:** Taller ya cancelado o completado.

---

### `POST /workshops/{id}/register` — Student autenticado
Inscribe al usuario autenticado. Idempotente.

**Respuesta 201** cuando crea la inscripción:
```json
{
  "workshopId": "abc-123",
  "userId": "cognito-sub",
  "status": "confirmed",
  "registeredAt": "2026-04-12T10:00:00Z"
}
```
**Respuesta 200** si la inscripción ya existía y sigue confirmada.
**Respuesta 409:** Taller completo o ya finalizado.

La creación, reprogramación o cancelación del taller ajusta automáticamente un recordatorio 24h antes mediante EventBridge Scheduler.

---

### `DELETE /workshops/{id}/register` — Student / Admin
Cancela la inscripción del usuario autenticado (o de `?userId=` si es admin).

**Respuesta 204:** Sin cuerpo.

---

### `GET /workshops/{id}/registrations` — Admin
Lista todos los inscritos de un taller.

**Respuesta 200:**
```json
{ "items": [ ...Registration[] ], "count": 18 }
```

---

## Usuarios (Participants)

### `GET /users` — Admin
Lista los perfiles de usuario creados en la plataforma, incluyendo activos e inactivos.

**Respuesta 200:**
```json
{ "items": [ ...User[] ], "count": 12 }
```

---

### `GET /users/{id}` — Admin / Usuario autenticado
Admin puede consultar cualquier perfil. Un usuario autenticado puede consultar el suyo.

**Respuesta 200:** `User`
**Respuesta 403:** sin permisos para consultar otro perfil
**Respuesta 404:** usuario no encontrado

---

### `PUT /users/{id}` — Admin
Actualiza parcialmente un perfil de usuario.

Validaciones de negocio:
- `email`, `givenName`, `familyName` y `department` no pueden quedar vacíos si se envían
- `role` debe ser `admin`, `manager` o `student`
- `fullName` se recalcula automáticamente a partir de nombre y apellidos

**Respuesta 200:** `User` actualizado.

---

### `DELETE /users/{id}` — Admin
Desactiva al participante (`active = false`). No hace borrado duro: la ficha y el histórico permanecen disponibles.

**Respuesta 204:** Sin cuerpo.
**Respuesta 409:** el participante ya estaba inactivo.

---

### `GET /users/{id}/registrations` — Admin / Usuario autenticado
Lista las inscripciones de un usuario. Admin puede consultar cualquier usuario; un usuario autenticado solo puede consultar las suyas.

**Respuesta 200:**
```json
{ "items": [ ...Registration[] ], "count": 4 }
```

Cada inscripción puede incluir `workshop` con el detalle del taller asociado.

---

## Evidencias y Archivos

### `POST /evidences/presign-upload` — Admin
Genera una URL firmada temporal para subir un archivo al bucket privado de evidencias mediante `PUT`.

**Body:**
```json
{
  "fileName": "brochure-prl.pdf",
  "contentType": "application/pdf",
  "folder": "brochures"
}
```

**Respuesta 200:**
```json
{
  "fileKey": "brochures/1710000000000-brochure-prl.pdf",
  "uploadUrl": "https://...",
  "expiresIn": 900,
  "method": "PUT",
  "headers": {
    "Content-Type": "application/pdf"
  }
}
```

---

### `POST /evidences/presign-download` — Admin
Genera una URL firmada temporal para descargar un archivo existente del bucket privado de evidencias.

**Body:**
```json
{
  "fileKey": "brochures/1710000000000-brochure-prl.pdf",
  "downloadName": "brochure-prl.pdf"
}
```

**Respuesta 200:**
```json
{
  "fileKey": "brochures/1710000000000-brochure-prl.pdf",
  "downloadUrl": "https://...",
  "expiresIn": 900,
  "method": "GET"
}
```

---

## Certificados (Certs)

### `POST /certs/issue` — Admin
Emite un certificado a un participante.

**Body:**
```json
{
  "userId": "cognito-sub",
  "workshopId": "abc-123",
  "score": 92,
  "expiresAt": "2027-05-10T00:00:00Z"
}
```
**Respuesta 201:** `Cert` emitido.
**Respuesta 409:** Ya existe un certificado para esa inscripción.

---

### `GET /certs` — Autenticado
Certificados del usuario autenticado. Admin puede pasar `?userId=` para consultar otro usuario.

**Respuesta 200:** `{ items: Cert[], count: number }`

---

### `GET /certs/{id}/verify` — Público
Verifica la autenticidad de un certificado por su ID.

**Respuesta 200:**
```json
{
  "certId": "uuid",
  "workshopName": "PRL Nivel Básico",
  "norm": "Ley 31/1995",
  "issuedAt": "2026-05-10T17:30:00Z",
  "expiresAt": "2027-05-10T00:00:00Z",
  "status": "valid",
  "valid": true
}
```

---

## Modelos

### Workshop
```typescript
{
  id: string;
  name: string;
  description: string;
  category: string;
  mode: 'presencial' | 'online' | 'hibrida';
  location?: string;
  startAt: string;         // ISO 8601
  endAt: string;
  durationHours: number;
  capacity: number;
  enrolledCount: number;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  generatesCert: boolean;
  certNorm?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Registration
```typescript
{
  workshopId: string;
  userId: string;
  status: 'confirmed' | 'waitlist' | 'cancelled' | 'completed' | 'no_show';
  registeredAt: string;
  completedAt?: string;
  score?: number;
  attended?: boolean;
  certIssued?: boolean;
  certId?: string;
}
```

### User
```typescript
{
  id: string;
  email: string;
  givenName: string;
  familyName: string;
  fullName: string;
  department: string;
  role: 'admin' | 'manager' | 'student';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Cert
```typescript
{
  certId: string;
  userId: string;
  workshopId: string;
  workshopName: string;
  norm?: string;
  issuedAt: string;
  expiresAt?: string;
  status: 'valid' | 'expired' | 'revoked';
  score?: number;
}
```

---

## Códigos de error

Todos los errores siguen el formato `application/problem+json` (RFC 7807):

```json
{
  "type": "https://formaton.app/errors/NOT_FOUND",
  "title": "NOT_FOUND",
  "status": 404,
  "detail": "Workshop no encontrado"
}
```

| Status | Código | Descripción |
|--------|--------|-------------|
| 400 | `BAD_REQUEST` | Parámetros o body inválidos |
| 401 | `UNAUTHORIZED` | Token ausente, inválido o expirado |
| 403 | `FORBIDDEN` | Sin permisos para la operación |
| 404 | `NOT_FOUND` | Recurso no encontrado |
| 409 | `CONFLICT` | Estado incompatible (ej: cupo lleno, ya inscrito) |
| 500 | `INTERNAL_ERROR` | Error interno del servidor |
