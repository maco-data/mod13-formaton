import api from './api';

export interface Participant {
  id: string;
  email: string;
  givenName: string;
  familyName: string;
  fullName: string;
  department: string;
  role: 'admin' | 'manager' | 'student';
  active: boolean;
  createdAt: string;
}

export interface CreateParticipantPayload {
  email: string;
  givenName: string;
  familyName: string;
  department: string;
  role: Participant['role'];
}

export interface UpdateParticipantPayload extends Partial<CreateParticipantPayload> {
  active?: boolean;
}

export interface UserRegistration {
  workshopId: string;
  userId: string;
  status: string;
  registeredAt: string;
  workshop?: {
    id: string;
    name: string;
    description: string;
    category: string;
    mode: 'presencial' | 'online' | 'hibrida';
    location?: string;
    startAt: string;
    endAt: string;
    durationHours: number;
    capacity: number;
    enrolledCount: number;
    status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    generatesCert: boolean;
    certNorm?: string;
  } | null;
}

export const participantsService = {
  list: () =>
    api.get<{ items: Participant[]; count: number }>('/users'),

  get: (id: string) =>
    api.get<Participant>(`/users/${id}`),

  create: (payload: CreateParticipantPayload) =>
    api.post<Participant>('/users', payload),

  update: (id: string, payload: UpdateParticipantPayload) =>
    api.put<Participant>(`/users/${id}`, payload),

  deactivate: (id: string) =>
    api.delete<void>(`/users/${id}`),

  registrations: (id: string) =>
    api.get<{ items: UserRegistration[]; count: number }>(`/users/${id}/registrations`),
};

export default participantsService;
