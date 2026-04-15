import { useState, useCallback, useEffect } from 'react';
import participantsService, { type CreateParticipantPayload, type Participant } from '../services/participants.service';

interface State {
  items: Participant[];
  loading: boolean;
  error: string | null;
}

export function useParticipants() {
  const [state, setState] = useState<State>({ items: [], loading: false, error: null });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await participantsService.list();
      setState({ items: res.items, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (payload: CreateParticipantPayload): Promise<Participant> => {
    const participant = await participantsService.create(payload);
    setState((s) => ({ ...s, items: [participant, ...s.items] }));
    return participant;
  }, []);

  return {
    participants: state.items,
    loading: state.loading,
    error: state.error,
    create,
    reload: load,
  };
}
