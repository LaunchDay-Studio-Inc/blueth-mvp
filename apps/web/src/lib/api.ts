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

/** Recent API request log (ring buffer of last 20 entries). */
export interface ApiLogEntry {
  method: string;
  path: string;
  status: number | null;
  error: string | null;
  ts: number;
}
const API_LOG_SIZE = 20;
export const apiLog: ApiLogEntry[] = [];

function pushLog(entry: ApiLogEntry) {
  apiLog.push(entry);
  if (apiLog.length > API_LOG_SIZE) apiLog.shift();
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

  let res: Response;
  try {
    res = await fetch(url, opts);
  } catch {
    pushLog({ method, path, status: null, error: 'Network error', ts: Date.now() });
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error — check your connection');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.status === 401 ? 'Session expired' : 'Unknown error', code: 'UNKNOWN' }));
    const msg = data.error || (res.status === 401 ? 'Session expired' : res.statusText);
    const code = data.code || (res.status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN');
    pushLog({ method, path, status: res.status, error: msg, ts: Date.now() });
    throw new ApiError(res.status, code, msg);
  }

  pushLog({ method, path, status: res.status, error: null, ts: Date.now() });

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
