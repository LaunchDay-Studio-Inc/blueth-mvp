export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('guest_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: getAuthHeaders(),
    credentials: 'include',
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const url = API_BASE ? `${API_BASE}${path}` : `/api${path}`;
  const res = await fetch(url, opts);

  if (res.status === 401) {
    // Don't redirect in itch mode — auth-context handles guest auto-login
    if (typeof window !== 'undefined' && !API_BASE) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error', code: 'UNKNOWN' }));
    throw new ApiError(res.status, data.code || 'UNKNOWN', data.error || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
