import { useState, useEffect, useCallback } from 'react';
import certsService, { Cert, IssueCertPayload } from '../services/certs.service';

interface State {
  items: Cert[];
  loading: boolean;
  error: string | null;
}

export function useCerts(userId?: string) {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await certsService.list(userId);
      setState({ items: res.items, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const issue = useCallback(async (payload: IssueCertPayload): Promise<Cert> => {
    const cert = await certsService.issue(payload);
    setState(s => ({ ...s, items: [cert, ...s.items] }));
    return cert;
  }, []);

  const verify = useCallback((certId: string) => certsService.verify(certId), []);

  return {
    certs: state.items,
    loading: state.loading,
    error: state.error,
    issue,
    verify,
    reload: load,
  };
}
