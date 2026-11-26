import { NextResponse, type NextRequest } from 'next/server';
import { isStorefrontHandle, storefrontHostHandle } from './lib/storefront-address';

const reservedTenantPaths = /^\/(?:s|marketplace|join)(?:\/|$)/;
const legacyMarketplacePath = /^\/marketplace(?:\/|$)/;

function redirectLegacyMarketplacePath(request: NextRequest, path: string) {
  const url = new URL(request.url);
  url.host = request.headers.get('host') ?? url.host;
  url.port = new URL(`${url.protocol}//${request.headers.get('host') ?? url.host}`).port;
  if (request.headers.get('x-forwarded-proto') === 'https') url.protocol = 'https:';
  url.pathname = path.replace(legacyMarketplacePath, '') || '/';
  return NextResponse.redirect(url, 308);
}

function unavailable(request: NextRequest, handle: string | null) {
  const url = new URL(request.url);
  url.pathname = '/unavailable';
  url.search = '';
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-waffarly-storefront-handle');
  if (handle !== null && isStorefrontHandle(handle)) {
    requestHeaders.set('x-waffarly-storefront-handle', handle);
  }
  return NextResponse.rewrite(url, {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
    request: { headers: requestHeaders },
  });
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Always replace this private routing context, including on the main domain.
  requestHeaders.delete('x-waffarly-storefront-handle');
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  // Nginx preserves Host; never choose a tenant from client-supplied forwarded headers.
  const handle = storefrontHostHandle(request.headers.get('host') ?? '');
  const path = request.nextUrl.pathname;

  if (
    path.startsWith('/_next/') ||
    path.startsWith('/storefront-api/') ||
    path === '/favicon.ico' ||
    path.startsWith('/storefront-assets/') ||
    path.startsWith('/marketplace-assets/') ||
    path === '/unavailable'
  ) {
    return next();
  }

  if (handle === null) {
    if (legacyMarketplacePath.test(path)) {
      return redirectLegacyMarketplacePath(request, path);
    }
    return next();
  }

  if (handle === 'marketplace') {
    if (legacyMarketplacePath.test(path)) {
      return redirectLegacyMarketplacePath(request, path);
    }
    if (/^\/s(?:\/|$)/.test(path)) return unavailable(request, handle);
    return next();
  }

  if (isStorefrontHandle(handle)) {
    if (!reservedTenantPaths.test(path)) {
      // Preserve the raw origin so a loopback bind remains an internal rewrite.
      const url = new URL(request.url);
      // Only carry the public handle here; resolve it through the API in the page loader.
      url.pathname = '/s/' + encodeURIComponent(handle) + (path === '/' ? '' : path);
      requestHeaders.set('x-waffarly-storefront-handle', handle);
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  return unavailable(request, handle);
}
