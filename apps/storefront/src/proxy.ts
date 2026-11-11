import { NextResponse, type NextRequest } from 'next/server';
import { localStorefrontAliases } from './lib/local-storefront-aliases';
import { isStorefrontHandle, localStorefrontHandle } from './lib/storefront-address';

export function proxy(request: NextRequest) {
  // This slice deliberately does not enable production host routing.
  if (process.env.NODE_ENV !== 'development') return NextResponse.next();
  // Next can construct nextUrl using the dev server's bind hostname (0.0.0.0).
  // For local host routing, use the hostname the browser actually requested.
  const handle = localStorefrontHandle(request.headers.get('host') ?? '');
  if (handle === null) return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (path.startsWith('/_next/') || path === '/favicon.ico' ||
      path.startsWith('/storefront-assets/') || path.startsWith('/marketplace-assets/')) {
    return NextResponse.next();
  }

  if (handle === 'marketplace') {
    if (path === '/' || path === '/marketplace' || path.startsWith('/marketplace/') || path === '/join') {
      if (path !== '/') return NextResponse.next();
      const url = request.nextUrl.clone();
      url.pathname = '/marketplace';
      return NextResponse.rewrite(url);
    }
  } else if (isStorefrontHandle(handle)) {
    const slug = localStorefrontAliases()[handle];
    if (slug && !/^\/(?:s|marketplace|join)(?:\/|$)/.test(path)) {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${encodeURIComponent(slug)}${path === '/' ? '' : path}`;
      return NextResponse.rewrite(url);
    }
  }
  return new NextResponse('المتجر غير موجود أو العنوان محجوز لتطبيق آخر. / Store not found or reserved application address.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
