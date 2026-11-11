import { isStorefrontHandle } from '@waffarly/contracts';

export function storefrontUrl(handle: string): string | null {
  if (!isStorefrontHandle(handle)) return null;
  const base =
    import.meta.env.VITE_STOREFRONT_BASE_URL ||
    (import.meta.env.DEV ? 'http://localhost:3000' : '');
  if (!base) return null;
  const url = new URL(base);
  url.hostname = `${handle}.${url.hostname}`;
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString();
}
