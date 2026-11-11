import { NextResponse, type NextRequest } from 'next/server';
import { isStorefrontHandle, storefrontHostHandle } from './lib/storefront-address';

const reservedTenantPaths = /^\/(?:s|marketplace|join)(?:\/|$)/;
const legacyMarketplacePath = /^\/marketplace(?:\/|$)/;

function redirectLegacyMarketplacePath(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path.replace(legacyMarketplacePath, '') || '/';
  return NextResponse.redirect(url, 308);
}

function unavailable() {
  return new NextResponse(
    'المتجر غير موجود أو العنوان محجوز لتطبيق آخر. / Store not found or reserved application address.',
    {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
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
    path === '/favicon.ico' ||
    path.startsWith('/storefront-assets/') ||
    path.startsWith('/marketplace-assets/')
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
    if (/^\/s(?:\/|$)/.test(path)) return unavailable();
    return next();
  }

  if (isStorefrontHandle(handle)) {
    if (!reservedTenantPaths.test(path)) {
      const url = request.nextUrl.clone();
      // Only carry the public handle here; resolve it through the API in the page loader.
      url.pathname = '/s/' + encodeURIComponent(handle) + (path === '/' ? '' : path);
      requestHeaders.set('x-waffarly-storefront-handle', handle);
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  return unavailable();
}
