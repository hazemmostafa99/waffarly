import { ApiError, apiBaseUrl } from '@/lib/api-client';
export async function customerOrdersRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    new URL(path.replace(/^\//, ''), apiBaseUrl().replace(/\/$/, '') + '/'),
    {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
    throw new ApiError(
      typeof data?.message === 'string' ? data.message : 'تعذر تحميل الطلب. حاول مرة أخرى.',
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
