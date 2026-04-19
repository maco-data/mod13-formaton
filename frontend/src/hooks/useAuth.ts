import { useEffect, useCallback } from 'react';
import type { FormatonUser } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

// ─── Local fallback ───────────────────────────────────────────────────────────
// Si no hay Cognito configurado, solo se permiten las credenciales demo
// documentadas para no dar sensación de "modo fake" abierto.
const DEMO_MODE = !import.meta.env.VITE_USER_POOL_ID;

const DEMO_USERS: Record<string, FormatonUser> = {
  'admin@formaton.demo': {
    sub: 'demo-admin-001',
    email: 'admin@formaton.demo',
    givenName: 'Admin',
    familyName: 'Formaton',
    department: 'Recursos Humanos',
    role: 'admin',
    groups: ['admin'],
  },
  'student@formaton.demo': {
    sub: 'demo-student-001',
    email: 'student@formaton.demo',
    givenName: 'Student',
    familyName: 'Formaton',
    department: 'Operaciones',
    role: 'student',
    groups: ['student'],
  },
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
        const activeEmail = sessionStorage.getItem(DEMO_SESSION_KEY);
        setSession(activeEmail ? DEMO_USERS[activeEmail] ?? null : null, null);
        setInitialized(true);
        setLoading(false);
        return;
      }

      try {
        const { configureAmplify, getCurrentFormatonUser, getAccessToken } = await import('../services/auth.service');
        configureAmplify();
        const [user, token] = await Promise.all([getCurrentFormatonUser(), getAccessToken()]);
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
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        setLoading(false);
        setError('Introduce email y contraseña');
        throw new Error('Credenciales vacías');
      }

      if (password !== 'Formaton2026!' || !DEMO_USERS[normalizedEmail]) {
        setLoading(false);
        setError('Credenciales incorrectas');
        throw new Error('Credenciales incorrectas');
      }

      sessionStorage.setItem(DEMO_SESSION_KEY, normalizedEmail);
      setSession(DEMO_USERS[normalizedEmail], null);
      setInitialized(true);
      setLoading(false);
      return;
    }

    try {
      const { configureAmplify, login, getCurrentFormatonUser, getAccessToken } = await import('../services/auth.service');
      configureAmplify();
      await login(email, password);
      const [user, token] = await Promise.all([getCurrentFormatonUser(), getAccessToken()]);
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
