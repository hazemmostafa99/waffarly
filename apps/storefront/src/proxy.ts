import { NextResponse, type NextRequest } from 'next/server';
import { isStorefrontHandle, localStorefrontHandle } from './lib/storefront-address';

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
  // This slice deliberately does not enable production host routing.
  if (process.env.NODE_ENV !== 'development') return NextResponse.next();

  // Next can construct nextUrl using the dev server's bind hostname (0.0.0.0).
  // For local host routing, use the hostname the browser actually requested.
  const handle = localStorefrontHandle(request.headers.get('host') ?? '');
  const path = request.nextUrl.pathname;

  if (
    path.startsWith('/_next/') ||
    path === '/favicon.ico' ||
    path.startsWith('/storefront-assets/') ||
    path.startsWith('/marketplace-assets/')
  ) {
    return NextResponse.next();
  }

  if (handle === null) {
    if (legacyMarketplacePath.test(path)) {
      return redirectLegacyMarketplacePath(request, path);
    }
    return NextResponse.next();
  }

  if (handle === 'marketplace') {
    if (legacyMarketplacePath.test(path)) {
      return redirectLegacyMarketplacePath(request, path);
    }
    if (/^\/s(?:\/|$)/.test(path)) return unavailable();
    return NextResponse.next();
  }

  if (isStorefrontHandle(handle)) {
    if (!reservedTenantPaths.test(path)) {
      const url = request.nextUrl.clone();
      // Only carry the public handle here; resolve it through the API in the page loader.
      url.pathname = '/s/' + encodeURIComponent(handle) + (path === '/' ? '' : path);
      return NextResponse.rewrite(url);
    }
  }

  return unavailable();
}
