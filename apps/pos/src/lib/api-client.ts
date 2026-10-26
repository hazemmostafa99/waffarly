export function apiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  if (!value) {
    throw new Error('VITE_API_BASE_URL is missing. Set it in apps/pos/.env.local.');
  }
  return value;
}

export type ApiValidationIssue = {
  path: Array<string | number>;
  message: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly issues: ApiValidationIssue[] = [],
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

export function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestApi<T>(path, init, false);
}

export function apiRequestNullable<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  return requestApi<T | null>(path, init, true);
}

async function requestApi<T>(
  path: string,
  init: RequestInit,
  emptyResponseAsNull: boolean,
): Promise<T> {
  const response = await fetch(
    new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`),
    buildApiRequestOptions(init),
  );
  return parseApiResponse<T>(response, emptyResponseAsNull) as Promise<T>;
}

export async function parseApiResponse<T>(
  response: Response,
  emptyResponseAsNull = false,
): Promise<T | null> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const issues: ApiValidationIssue[] = Array.isArray(body?.message)
      ? body.message.filter(
          (entry): entry is ApiValidationIssue =>
            entry !== null &&
            typeof entry === 'object' &&
            Array.isArray(entry.path) &&
            entry.path.every(
              (part: unknown) => typeof part === 'string' || typeof part === 'number',
            ) &&
            typeof entry.message === 'string',
        )
      : [];
    const message = Array.isArray(body?.message)
      ? [
          ...new Set(
            body.message.flatMap((entry) =>
              typeof entry === 'string' ? [entry] : issues.includes(entry) ? [entry.message] : [],
            ),
          ),
        ].join(', ')
      : typeof body?.message === 'string'
        ? body.message
        : '';
    throw new ApiError(
      message || `API request failed with status ${response.status}.`,
      response.status,
      issues,
    );
  }
  if (response.status === 204) return (emptyResponseAsNull ? null : undefined) as T | null;

  const body = await response.text();
  if (emptyResponseAsNull && body.trim() === '') return null;
  return JSON.parse(body) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}
