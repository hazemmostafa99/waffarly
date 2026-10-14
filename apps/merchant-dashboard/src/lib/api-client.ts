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
  return readResponse<T>(response);
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
