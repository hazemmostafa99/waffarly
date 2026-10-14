import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: [
    'merchant-products.spec.ts',
    'merchant-categories.spec.ts',
    'merchant-dashboard.spec.ts',
  ],
  webServer: Array.isArray(config.webServer)
    ? config.webServer.filter((server) => server.cwd === './apps/merchant-dashboard')
    : config.webServer,
});
