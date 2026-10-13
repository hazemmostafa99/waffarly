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

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`));
  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}.`, response.status);
  }
  return (await response.json()) as T;
}
