import api from './api';

export interface Cert {
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

export interface IssueCertPayload {
  userId: string;
  workshopId: string;
  score?: number;
  expiresAt?: string;
}

export interface VerifyCertResponse {
  certId: string;
  workshopName: string;
  norm?: string;
  issuedAt: string;
  expiresAt?: string;
  status: string;
  valid: boolean;
}

export const certsService = {
  list: (userId?: string) => {
    const qs = userId ? `?userId=${userId}` : '';
    return api.get<{ items: Cert[]; count: number }>(`/certs${qs}`);
  },

  issue: (payload: IssueCertPayload) =>
    api.post<Cert>('/certs/issue', payload),

  verify: (certId: string) =>
    api.get<VerifyCertResponse>(`/certs/${certId}/verify`, true),
};

export default certsService;
