import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.WAFFARLY_UI_TEST === '1' ? '.next-ui-tests' : '.next',
  transpilePackages: ['@waffarly/ui'],
};

export default nextConfig;
