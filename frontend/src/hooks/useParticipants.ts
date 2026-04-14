import { useState, useCallback, useEffect } from 'react';
import participantsService, { type Participant } from '../services/participants.service';

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

  return {
    participants: state.items,
    loading: state.loading,
    error: state.error,
    reload: load,
  };
}
