export type RegistrationStatus = 'confirmed' | 'waitlist' | 'cancelled' | 'completed' | 'no_show';

export interface Registration {
  PK: string;            // WORKSHOP#<workshopId>
  SK: string;            // REG#USER#<userId>
  workshopId: string;
  userId: string;
  status: RegistrationStatus;
  registeredAt: string;  // ISO 8601
  completedAt?: string;
  score?: number;        // 0–100
  attended?: boolean;
  certIssued?: boolean;
  certId?: string;
  // GSI — inscripciones de un usuario
  GSI1PK: string;        // USER#<userId>
  GSI1SK: string;        // REG#<workshopId>
}

export type RegisterInput = {
  workshopId: string;
  userId: string;
};
