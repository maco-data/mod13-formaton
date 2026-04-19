/**
 * Formaton — API client
 * Centraliza todas las llamadas a la API Gateway.
 * Inyecta automáticamente el JWT de Cognito en cada petición.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

async function getToken(): Promise<string | null> {
  const { useAuthStore } = await import('../store/auth.store');
  const storedToken = useAuthStore.getState().token;
  if (storedToken) return storedToken;

  try {
    const { getIdToken } = await import('./auth.service');
    return await getIdToken();
  } catch {
    return localStorage.getItem('formaton_id_token');
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('json');

  if (isJson) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    const text = await response.text();
    return text ? { detail: text } : undefined;
  } catch {
    return undefined;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isPublic = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!isPublic) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorBody = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
    const fallbackMessage = response.statusText
      ? `Error ${response.status}: ${response.statusText}`
      : `Error ${response.status}`;
    const err = Object.assign(new Error(String(errorBody.detail ?? errorBody.message ?? fallbackMessage)), {
      statusCode: response.status,
      code: errorBody.title ?? errorBody.code,
    });
    throw err;
  }

  return data as T;
}

// ── Shortcuts ──────────────────────────────────────────────────────────────
export const api = {
  get:    <T>(path: string, isPublic = false) => request<T>('GET', path, undefined, isPublic),
  post:   <T>(path: string, body: unknown)    => request<T>('POST', path, body),
  put:    <T>(path: string, body: unknown)    => request<T>('PUT', path, body),
  delete: <T>(path: string)                   => request<T>('DELETE', path),
};

export default api;
