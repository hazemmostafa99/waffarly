export function apiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  if (!value) {
    throw new Error('VITE_API_BASE_URL is missing. Set it in apps/pos/.env.local.');
  }
  return value;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function buildApiRequestOptions(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  // JSON requests need this header; adding it to bodyless GETs causes a CORS preflight.
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return {
    ...init,
    cache: init.cache ?? 'no-store',
    credentials: 'include',
    headers,
  };
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(
    new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`),
    buildApiRequestOptions(init),
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `API request failed with status ${response.status}.`);
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}
