export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is missing. Set it in apps/storefront/.env.local.');
  }
  return value;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ''), `${getApiBaseUrl()}/`));
  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}.`, response.status);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ''), `${getApiBaseUrl()}/`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
