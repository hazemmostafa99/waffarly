import { apiRequest, apiRequestPage } from './api-client.js';

// Share only in-flight reads. Include the tenant so an account switch cannot reuse
// another merchant's response, and retain no directory cache after completion.
const pending = new Map<string, Promise<unknown>>();

function share<T>(key: string, read: () => Promise<T>): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const request = read();
  pending.set(key, request);
  void request
    .finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    })
    .catch(() => {});
  return request;
}

export function lookupPage<T>(tenant: string, path: string) {
  return share(`${tenant}:page:${path}`, () => apiRequestPage<T>(path));
}

export function lookupSelection<T>(tenant: string, path: string) {
  return share(`${tenant}:item:${path}`, () => apiRequest<T>(path));
}
