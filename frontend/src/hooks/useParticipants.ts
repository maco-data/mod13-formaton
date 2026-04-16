import { useState, useCallback, useEffect } from 'react';
import participantsService, { type CreateParticipantPayload, type Participant, type UpdateParticipantPayload } from '../services/participants.service';

interface State {
  items: Participant[];
  loading: boolean;
  error: string | null;
}

interface UseParticipantsOptions {
  enabled?: boolean;
}

export function useParticipants(options: UseParticipantsOptions = {}) {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<State>({ items: [], loading: enabled, error: null });

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await participantsService.list();
      setState({ items: Array.isArray(res?.items) ? res.items : [], loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (payload: CreateParticipantPayload): Promise<Participant> => {
    const participant = await participantsService.create(payload);
    setState((s) => ({ ...s, items: [participant, ...s.items] }));
    return participant;
  }, []);

  const update = useCallback(async (id: string, payload: UpdateParticipantPayload): Promise<Participant> => {
    const participant = await participantsService.update(id, payload);
    setState((s) => ({
      ...s,
      items: s.items.map((item) => (item.id === id ? participant : item)),
    }));
    return participant;
  }, []);

  const remove = useCallback(async (id: string) => {
    await participantsService.remove(id);
    setState((s) => ({
      ...s,
      items: s.items.map((item) => (item.id === id ? { ...item, active: false } : item)),
    }));
  }, []);

  return {
    participants: state.items,
    loading: state.loading,
    error: state.error,
    create,
    update,
    remove,
    reload: load,
  };
}
