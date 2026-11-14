import { workspacePath } from './paths.js';
import { defineConfig } from '@playwright/test';
import config from './base.config.js';

export default defineConfig({
  outputDir: workspacePath('test-results'),
  ...config,
  testMatch: ['routes.spec.ts', 'platforms.spec.ts', 'merchant-dashboard.spec.ts'],
  grepInvert: /storefront and application/,
  webServer: Array.isArray(config.webServer)
    ? config.webServer.filter((server) => server.cwd !== workspacePath('apps/storefront'))
    : config.webServer,
});
