export { isStorefrontHandle } from '@waffarly/contracts';

export function localStorefrontHandle(hostname: string): string | null {
  // Accept the HTTP Host header, which includes the development port.
  const normalized = hostname.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!normalized.endsWith('.localhost')) return null;
  return normalized.slice(0, -'.localhost'.length);
}

export function storefrontHostHandle(hostname: string): string | null {
  if (process.env.NODE_ENV === 'development') return localStorefrontHandle(hostname);
  const domain = process.env.STOREFRONT_BASE_DOMAIN?.trim().toLowerCase();
  if (!domain) return null;
  const normalized = hostname.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!normalized.endsWith(`.${domain}`)) return null;
  return normalized.slice(0, -(domain.length + 1));
}

export function storefrontRequestHandle(headers: { get(name: string): string | null }): string | null {
  // Proxy replaces this header on every request; internal rewrites may normalize Host.
  return headers.get('x-waffarly-storefront-handle') ?? storefrontHostHandle(headers.get('host') ?? '');
}

export function storefrontHref(href: string, slug: string, hostBased: boolean): string {
  if (!hostBased) return href;
  const prefix = `/s/${encodeURIComponent(slug)}`;
  if (href === prefix) return '/';
  if (href.startsWith(`${prefix}/`)) return href.slice(prefix.length);
  if (href.startsWith(`${prefix}?`) || href.startsWith(`${prefix}#`)) {
    return `/${href.slice(prefix.length)}`;
  }
  return href;
}
