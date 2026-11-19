import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep loopback rewrite origins intact (NextURL otherwise changes 127.0.0.1 to localhost).
  skipProxyUrlNormalize: true,
  distDir: process.env.WAFFARLY_UI_TEST === '1' ? '.next-ui-tests' : '.next',
  transpilePackages: ['@waffarly/ui'],
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    if (!api) return [];
    // Keep merchant customer cookies on the storefront host, including *.localhost.
    // Only existing public storefront endpoints are exposed through this prefix.
    return [
      {
        source: '/storefront-api/auth/stores/:slug/customer/:action(sign-up|login|me|logout)',
        destination: `${api}/auth/stores/:slug/customer/:action`,
      },
      {
        source: '/storefront-api/catalog/stores/:slug/customer/orders',
        destination: `${api}/catalog/stores/:slug/customer/orders`,
      },
      {
        source: '/storefront-api/catalog/stores/:slug/orders',
        destination: `${api}/catalog/stores/:slug/orders`,
      },
    ];
  },
};

export default nextConfig;
