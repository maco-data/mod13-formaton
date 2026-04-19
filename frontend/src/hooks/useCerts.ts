import { useState, useEffect, useCallback } from 'react';
import certsService, { Cert, IssueCertPayload } from '../services/certs.service';

interface State {
  items: Cert[];
  loading: boolean;
  error: string | null;
}

interface UseCertsOptions {
  enabled?: boolean;
}

export function useCerts(userId?: string, options: UseCertsOptions = {}) {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<State>({ items: [], loading: enabled, error: null });

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await certsService.list(userId);
      setState({ items: Array.isArray(res?.items) ? res.items : [], loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [enabled, userId]);

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
