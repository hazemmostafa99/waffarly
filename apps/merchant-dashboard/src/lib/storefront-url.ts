import { isStorefrontHandle } from '@waffarly/contracts';

export function storefrontUrl(slug: string, handle?: string | null): string {
  const base = import.meta.env.VITE_STOREFRONT_BASE_URL || 'http://localhost:3000';
  const url = new URL(base);
  if (handle && isStorefrontHandle(handle)) {
    url.hostname = `${handle}.${url.hostname}`;
    url.pathname = '/';
  } else {
    url.pathname = `/s/${encodeURIComponent(slug)}`;
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}
