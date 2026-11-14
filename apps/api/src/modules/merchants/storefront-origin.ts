import { isStorefrontHandle } from '@waffarly/contracts';

/** Scope registered storefront origins to their catalog and customer authentication. */
export function storefrontRequestScope(
  origin: string,
  method: string,
  path: string,
  trustedOrigins: string[],
  baseDomain: string | undefined,
  allowLocal: boolean,
): {
  handle: string;
  slug: string | null;
} | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || url.username || url.password) return null;
  const local = allowLocal && url.hostname.endsWith('.localhost');
  const production =
    baseDomain && url.protocol === 'https:' && !url.port && url.hostname.endsWith(`.${baseDomain}`);
  if (!local && !production) return null;
  const domain = local ? 'localhost' : baseDomain!;
  const base = `${url.protocol}//${domain}${url.port ? `:${url.port}` : ''}`;
  // Reuse an explicitly trusted storefront origin; never trust arbitrary local ports.
  if (!trustedOrigins.includes(base)) return null;
  const handle = url.hostname.slice(0, -(domain.length + 1));
  if (!isStorefrontHandle(handle)) return null;
  const customerRead = path === '/auth/customer/me' && ['GET', 'HEAD', 'OPTIONS'].includes(method);
  const customerWrite =
    /^\/auth\/customer\/(?:sign-up|login|logout)$/.test(path) &&
    ['POST', 'OPTIONS'].includes(method);
  if (customerRead || customerWrite) return { handle, slug: null };
  const catalog =
    /^\/catalog\/stores\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(?:categories|products))?$/.exec(path);
  const checkout =
    /^\/catalog\/stores\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/orders(?:\/quote)?|\/products\/[0-9a-f-]+\/quote)$/.exec(
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
