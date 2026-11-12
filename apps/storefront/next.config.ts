import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep loopback rewrite origins intact (NextURL otherwise changes 127.0.0.1 to localhost).
  skipProxyUrlNormalize: true,
  distDir: process.env.WAFFARLY_UI_TEST === '1' ? '.next-ui-tests' : '.next',
  transpilePackages: ['@waffarly/ui'],
};

export default nextConfig;
