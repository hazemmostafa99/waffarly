import { isStorefrontHandle } from '@waffarly/contracts';

/** Match only public tenant catalog/checkout operations from a local storefront. */
export function localStorefrontRequestScope(
  origin: string,
  method: string,
  path: string,
  trustedOrigins: string[],
): {
  handle: string;
  slug: string;
} | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || !url.hostname.endsWith('.localhost')) return null;
  const base = `${url.protocol}//localhost${url.port ? `:${url.port}` : ''}`;
  // Reuse an explicitly trusted storefront origin; never trust arbitrary local ports.
  if (!trustedOrigins.includes(base)) return null;
  const handle = url.hostname.slice(0, -'.localhost'.length);
  if (!isStorefrontHandle(handle)) return null;
  const catalog =
    /^\/catalog\/stores\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(?:categories|products))?$/.exec(path);
  const checkout =
    /^\/catalog\/stores\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/orders|\/products\/[0-9a-f-]+\/quote)$/.exec(
      path,
    );
  const match = ['GET', 'HEAD'].includes(method)
    ? catalog
    : method === 'POST'
      ? checkout
      : method === 'OPTIONS'
        ? (catalog ?? checkout)
        : null;
  return match?.[1] ? { handle, slug: match[1] } : null;
}
