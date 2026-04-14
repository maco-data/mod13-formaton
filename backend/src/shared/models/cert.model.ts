export type CertStatus = 'valid' | 'expired' | 'revoked';

export interface Cert {
  PK: string;           // USER#<userId>
  SK: string;           // CERT#<certId>
  certId: string;
  userId: string;
  workshopId: string;
  workshopName: string;
  norm?: string;        // "ISO 45001", "Fundae", "Ley 31/1995"
  issuedAt: string;     // ISO 8601
  expiresAt?: string;   // null = no caduca
  status: CertStatus;
  fileKey?: string;     // S3 key del PDF
  score?: number;
  // GSI — búsqueda por certificado individual
  GSI1PK: string;       // CERT#<certId>
  GSI1SK: string;       // issuedAt
}

export interface IssueCertInput {
  userId: string;
  workshopId: string;
  score?: number;
  expiresAt?: string;
}
