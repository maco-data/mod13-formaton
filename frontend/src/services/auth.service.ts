/**
 * Formaton — Auth Service
 * Wrapper sobre AWS Amplify v6 para autenticación Cognito.
 * Instalar: npm install aws-amplify
 */
import { Amplify } from 'aws-amplify';
import {
  signIn,
  signOut,
  fetchAuthSession,
  getCurrentUser,
  fetchUserAttributes,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';

let isConfigured = false;

export function configureAmplify() {
  if (isConfigured) return;

  const userPoolId = import.meta.env.VITE_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_USER_POOL_CLIENT_ID;
  if (!userPoolId || !userPoolClientId) return;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: { email: true },
      },
    },
  });

  isConfigured = true;
}

export interface FormatonUser {
  sub: string;
  email: string;
  givenName: string;
  familyName: string;
  department?: string;
  role: 'admin' | 'manager' | 'student';
  groups: string[];
}

export async function login(email: string, password: string) {
  return signIn({ username: email, password });
}

export async function logout() {
  await signOut();
  localStorage.removeItem('formaton_id_token');
}

export async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) localStorage.setItem('formaton_id_token', token);
    return token ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentFormatonUser(): Promise<FormatonUser | null> {
  try {
    await getCurrentUser();
    const attrs = await fetchUserAttributes();
    const session = await fetchAuthSession();
    const groups: string[] = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) ?? [];
    const idPayload = session.tokens?.idToken?.payload;
    const email = attrs.email ?? String(idPayload?.email ?? '');
    const givenName = attrs.given_name ?? String(idPayload?.given_name ?? '');
    const familyName = attrs.family_name ?? String(idPayload?.family_name ?? '');
    const sub = attrs.sub ?? String(idPayload?.sub ?? '');

    return {
      sub,
      email,
      givenName,
      familyName,
      department: attrs['custom:department'] ?? (String(idPayload?.['custom:department'] ?? '') || undefined),
      role: (groups.includes('admin') ? 'admin' : groups.includes('manager') ? 'manager' : 'student'),
      groups,
    };
  } catch {
    return null;
  }
}

export { confirmSignIn, resetPassword, confirmResetPassword };
