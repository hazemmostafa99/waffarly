import 'server-only';
import { isStorefrontHandle } from './storefront-address';

/** Development configuration only. Never reserves or changes a merchant's slug. */
export function localStorefrontAliases(): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  if (process.env.NODE_ENV !== 'development') return result;
  const raw = process.env.LOCAL_STOREFRONT_ALIASES;
  if (!raw) return result;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('LOCAL_STOREFRONT_ALIASES must be a JSON object of handle: existing slug.');
  }
  for (const [handle, slug] of Object.entries(parsed)) {
    if (!isStorefrontHandle(handle) || typeof slug !== 'string' ||
        slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      // An unfinished example must not break other configured merchants.
      // Do not include configuration values in logs.
      console.warn('Ignoring an invalid entry in LOCAL_STOREFRONT_ALIASES. Check handle and slug syntax.');
      continue;
    }
    result[handle] = slug;
  }
  return result;
}
