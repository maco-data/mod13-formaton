export const CONSTANTS = {
  APP_NAME: 'Formaton',
  TABLE_NAME_PREFIX: 'formaton',
  EVENT_BUS_NAME: 'formaton-events',
  EVENT_SOURCE: 'formaton.app',

  // DynamoDB key patterns
  PK: {
    WORKSHOP: (id: string) => `WORKSHOP#${id}`,
    USER: (id: string) => `USER#${id}`,
    CERT: (id: string) => `CERT#${id}`,
  },
  SK: {
    META: 'META',
    REG: (userId: string) => `REG#USER#${userId}`,
    CERT: (certId: string) => `CERT#${certId}`,
  },
  GSI: {
    GSI1_PK: 'GSI1PK',
    GSI1_SK: 'GSI1SK',
    GSI2_PK: 'GSI2PK',
    GSI2_SK: 'GSI2SK',
  },

  // EventBridge event types
  EVENTS: {
    WORKSHOP_CREATED: 'workshop.created',
    WORKSHOP_UPDATED: 'workshop.updated',
    WORKSHOP_CANCELLED: 'workshop.cancelled',
    STUDENT_REGISTERED: 'student.registered',
    STUDENT_UNREGISTERED: 'student.unregistered',
    CERT_ISSUED: 'cert.issued',
    CERT_EXPIRING: 'cert.expiring',
    REMINDER_24H: 'reminder.24h',
  },

  // HTTP status codes used in responses
  HTTP: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL: 500,
  },
} as const;
