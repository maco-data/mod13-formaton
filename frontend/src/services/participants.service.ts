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

export const participantsService = {
  list: () =>
    api.get<{ items: Participant[]; count: number }>('/users'),

  get: (id: string) =>
    api.get<Participant>(`/users/${id}`),
};

export default participantsService;
