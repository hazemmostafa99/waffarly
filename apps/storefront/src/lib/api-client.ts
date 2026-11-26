export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiErrorMessage(body: unknown, status: number): string {
  const fallback = `API request failed with status ${status}.`;
  if (!body || typeof body !== 'object' || !('message' in body)) return fallback;
  const { message } = body;
  if (typeof message === 'string') return message;
  if (!Array.isArray(message)) return fallback;
  const details = message.flatMap((entry: unknown) => {
    if (typeof entry === 'string') return [entry];
    if (!entry || typeof entry !== 'object' || !('message' in entry)) return [];
    if (typeof entry.message !== 'string') return [];
    const path = 'path' in entry && Array.isArray(entry.path)
      ? entry.path.filter((part: unknown) => typeof part === 'string' || typeof part === 'number').join('.')
      : '';
    return [path ? `${path}: ${entry.message}` : entry.message];
  });
  return details.length ? details.join(', ') : fallback;
}

export function apiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is missing. Set it in apps/storefront/.env.local.');
  }
  return value;
}

export async function apiGet<T>(
  path: string,
  options: { revalidate?: number; tags?: string[] } = {},
): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`), {
    next: {
      revalidate: options.revalidate ?? 300,
      ...(options.tags ? { tags: options.tags } : {}),
    },
  });
  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}.`, response.status);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options: { credentials?: RequestCredentials; storefrontSession?: boolean } = {},
): Promise<T> {
  const url = options.storefrontSession
    ? `/storefront-api/${path.replace(/^\//, '')}`
    : new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`);
  const response = await fetch(url, {
    method: 'POST',
    credentials: options.credentials ?? 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new ApiError(apiErrorMessage(errorBody, response.status), response.status);
  }
  return (await response.json()) as T;
}

export async function apiGetBrowser<T>(
  path: string,
  options: { sameOrigin?: boolean } = {},
): Promise<T> {
  const apiPath = path.replace(/^\//, '');
  const url = options.sameOrigin
    ? `/storefront-api/${apiPath}`
    : new URL(apiPath, `${apiBaseUrl()}/`);
  const response = await fetch(url, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}.`, response.status);
  }
  return (await response.json()) as T;
}
