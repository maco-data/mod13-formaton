import { create } from 'zustand';

export interface AuthUser {
  sub: string;
  email: string;
  givenName: string;
  familyName: string;
  department?: string;
  role: 'admin' | 'manager' | 'student';
  groups: string[];
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (v: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (v: boolean) => void;
  setSession: (user: AuthUser | null, token: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  initialized: false,
  error: null,
  setUser:    (user)    => set({ user }),
  setToken:   (token)   => set({ token }),
  setLoading: (loading) => set({ loading }),
  setError:   (error)   => set({ error }),
  setInitialized: (initialized) => set({ initialized }),
  setSession: (user, token) => set({ user, token }),
  clear: () => set({ user: null, token: null, loading: false, initialized: true, error: null }),
}));
