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
