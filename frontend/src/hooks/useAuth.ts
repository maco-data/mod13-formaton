import { useEffect, useCallback } from 'react';
import type { FormatonUser } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

// ─── Demo mode ───────────────────────────────────────────────────────────────
// Si no hay VITE_USER_POOL_ID configurado, la app corre en modo demo local:
// cualquier email/contraseña es válido y se usa un usuario ficticio de admin.
const DEMO_MODE = !import.meta.env.VITE_USER_POOL_ID;

const DEMO_USER: FormatonUser = {
  sub: 'demo-user-001',
  email: 'admin@formaton.demo',
  givenName: 'Ana',
  familyName: 'Pérez',
  department: 'Recursos Humanos',
  role: 'admin',
  groups: ['admin'],
};

const DEMO_SESSION_KEY = 'formaton_demo_session';

// ─────────────────────────────────────────────────────────────────────────────

interface AuthState {
  user: FormatonUser | null;
  loading: boolean;
  error: string | null;
}

let initPromise: Promise<void> | null = null;

export function useAuth() {
  const state = useAuthStore((store) => ({
    user: store.user as AuthState['user'],
    token: store.token,
    loading: store.loading,
    initialized: store.initialized,
    error: store.error,
  }));

  const loadUser = useCallback(async (force = false) => {
    if (!force && state.initialized && !state.loading) return;
    if (initPromise) return initPromise;

    const { setLoading, setError, setInitialized, setSession } = useAuthStore.getState();

    initPromise = (async () => {
      setLoading(true);
      setError(null);

      if (DEMO_MODE) {
        const active = sessionStorage.getItem(DEMO_SESSION_KEY);
        setSession(active ? DEMO_USER : null, null);
        setInitialized(true);
        setLoading(false);
        return;
      }

      try {
        const { configureAmplify, getCurrentFormatonUser, getIdToken } = await import('../services/auth.service');
        configureAmplify();
        const [user, token] = await Promise.all([getCurrentFormatonUser(), getIdToken()]);
        setSession(user, token);
      } catch {
        setSession(null, null);
      } finally {
        setInitialized(true);
        setLoading(false);
      }
    })();

    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  }, [state.initialized, state.loading]);

  useEffect(() => {
    if (!state.initialized) {
      void loadUser();
    }
  }, [state.initialized, loadUser]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    const { setLoading, setError, setInitialized, setSession } = useAuthStore.getState();
    setLoading(true);
    setError(null);

    if (DEMO_MODE) {
      await new Promise(r => setTimeout(r, 600));
      if (!email || !password) {
        setLoading(false);
        setError('Introduce email y contraseña');
        throw new Error('Credenciales vacías');
      }
      sessionStorage.setItem(DEMO_SESSION_KEY, '1');
      setSession(DEMO_USER, null);
      setInitialized(true);
      setLoading(false);
      return;
    }

    try {
      const { configureAmplify, login, getCurrentFormatonUser, getIdToken } = await import('../services/auth.service');
      configureAmplify();
      await login(email, password);
      const [user, token] = await Promise.all([getCurrentFormatonUser(), getIdToken()]);
      setSession(user, token);
      setInitialized(true);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError((err as Error).message);
      throw err;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    const { clear } = useAuthStore.getState();

    if (DEMO_MODE) {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      clear();
      return;
    }

    const { logout } = await import('../services/auth.service');
    await logout();
    clear();
  }, []);

  return {
    user: state.user,
    token: state.token,
    loading: state.loading,
    error: state.error,
    isAdmin: state.user?.role === 'admin',
    isManager: state.user?.role === 'manager' || state.user?.role === 'admin',
    isAuthenticated: !!state.user,
    isDemoMode: DEMO_MODE,
    login: handleLogin,
    logout: handleLogout,
    reload: async () => {
      useAuthStore.getState().setInitialized(false);
      await loadUser(true);
    },
  };
}
