import { useState, useEffect, useCallback } from 'react';
import coursesService, { Workshop, CreateWorkshopPayload } from '../services/courses.service';

interface State {
  items: Workshop[];
  loading: boolean;
  error: string | null;
  nextToken?: string;
}

export function useCourses(filters?: { category?: string; status?: string }) {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null });

  const load = useCallback(async (nextToken?: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await coursesService.list({ ...filters, nextToken, limit: 20 });
      const items = Array.isArray(res?.items) ? res.items : [];
      setState(s => ({
        items: nextToken ? [...s.items, ...items] : items,
        loading: false,
        error: null,
        nextToken: res?.nextToken,
      }));
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [filters?.category, filters?.status]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (payload: CreateWorkshopPayload): Promise<Workshop> => {
    const workshop = await coursesService.create(payload);
    setState(s => ({ ...s, items: [workshop, ...s.items] }));
    return workshop;
  }, []);

  const update = useCallback(async (id: string, payload: Partial<CreateWorkshopPayload>): Promise<Workshop> => {
    const updated = await coursesService.update(id, payload);
    setState(s => ({ ...s, items: s.items.map(w => w.id === id ? updated : w) }));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await coursesService.delete(id);
    setState(s => ({ ...s, items: s.items.map(w => w.id === id ? { ...w, status: 'cancelled' as const } : w) }));
  }, []);

  const loadMore = useCallback(() => {
    if (state.nextToken) load(state.nextToken);
  }, [state.nextToken, load]);

  return {
    courses: state.items,
    loading: state.loading,
    error: state.error,
    hasMore: !!state.nextToken,
    create,
    update,
    remove,
    loadMore,
    reload: () => load(),
  };
}
