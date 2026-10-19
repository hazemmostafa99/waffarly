export function apiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  if (!value) {
    throw new Error('VITE_API_BASE_URL is missing. Set it in apps/merchant-dashboard/.env.local.');
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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`), {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const firstPage = await readResponse<unknown>(response);
  if ((init.method ?? 'GET').toUpperCase() !== 'GET' || !isCursorPage(firstPage)) {
    return firstPage as T;
  }

  const items = [...firstPage.items];
  let cursor = firstPage.nextCursor;
  while (cursor) {
    const nextUrl = new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`);
    nextUrl.searchParams.set('cursor', cursor);
    const nextResponse = await fetch(nextUrl, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    const page = await readResponse<unknown>(nextResponse);
    if (!isCursorPage(page)) throw new ApiError('API returned an invalid paginated response.', 500);
    items.push(...page.items);
    cursor = page.nextCursor;
  }
  return items as T;
}

/** Read a single response envelope without draining cursor pages. */
export async function apiRequestSingle<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`), {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  return readResponse<T>(response);
}

export async function apiRequestPage<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`), {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  return readResponse<{ items: T[]; nextCursor: string | null }>(response);
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`), {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  return readResponse<T>(response);
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `API request failed with status ${response.status}.`);
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

function isCursorPage(value: unknown): value is { items: unknown[]; nextCursor: string | null } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray(value.items) &&
    'nextCursor' in value &&
    (typeof value.nextCursor === 'string' || value.nextCursor === null)
  );
}
