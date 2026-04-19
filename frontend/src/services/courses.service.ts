import api from './api';

export interface Workshop {
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
}

export interface ListWorkshopsResponse {
  items: Workshop[];
  count: number;
  nextToken?: string;
}

export interface CreateWorkshopPayload {
  name: string;
  description?: string;
  category: string;
  mode: Workshop['mode'];
  location?: string;
  startAt: string;
  endAt: string;
  durationHours: number;
  capacity: number;
  generatesCert?: boolean;
  certNorm?: string;
}

export const coursesService = {
  list: (params?: { limit?: number; nextToken?: string; category?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit)     qs.set('limit', String(params.limit));
    if (params?.nextToken) qs.set('nextToken', params.nextToken);
    if (params?.category)  qs.set('category', params.category);
    if (params?.status)    qs.set('status', params.status);
    const query = qs.toString() ? `?${qs}` : '';
    return api.get<ListWorkshopsResponse>(`/workshops${query}`, true);
  },

  get: (id: string) =>
    api.get<Workshop>(`/workshops/${id}`, true),

  create: (payload: CreateWorkshopPayload) =>
    api.post<Workshop>('/workshops', payload),

  update: (id: string, payload: Partial<CreateWorkshopPayload>) =>
    api.put<Workshop>(`/workshops/${id}`, payload),

  delete: (id: string) =>
    api.delete<void>(`/workshops/${id}`),

  register: (id: string) =>
    api.post<{ status: string; registeredAt: string }>(`/workshops/${id}/register`, {}),

  unregister: (id: string) =>
    api.delete<void>(`/workshops/${id}/register`),

  getRegistrations: (id: string) =>
    api.get<{ items: unknown[]; count: number }>(`/workshops/${id}/registrations`),
};

export default coursesService;
