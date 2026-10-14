import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: ['routes.spec.ts', 'platforms.spec.ts', 'merchant-dashboard.spec.ts'],
  grepInvert: /storefront and application/,
  webServer: Array.isArray(config.webServer)
    ? config.webServer.filter((server) => server.cwd !== './apps/storefront')
    : config.webServer,
});
