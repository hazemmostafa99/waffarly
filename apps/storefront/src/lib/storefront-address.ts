export const RESERVED_STOREFRONT_HANDLES = new Set([
  'admin', 'pos', 'api', 'www', 'dashboard', 'merchant', 'marketplace', 'business',
]);

export function isStorefrontHandle(value: string): boolean {
  return value.length >= 3 && value.length <= 63 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    !RESERVED_STOREFRONT_HANDLES.has(value);
}

export function localStorefrontHandle(hostname: string): string | null {
  // Accept the HTTP Host header, which includes the development port.
  const normalized = hostname.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!normalized.endsWith('.localhost')) return null;
  return normalized.slice(0, -'.localhost'.length);
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
