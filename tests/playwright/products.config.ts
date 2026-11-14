import { workspacePath } from './paths.js';
import { defineConfig } from '@playwright/test';
import config from './base.config.js';

export default defineConfig({
  outputDir: workspacePath('test-results'),
  ...config,
  testMatch: [
    'merchant-products.spec.ts',
    'merchant-categories.spec.ts',
    'merchant-dashboard.spec.ts',
  ],
  webServer: Array.isArray(config.webServer)
    ? config.webServer.filter((server) => server.cwd === workspacePath('apps/merchant-dashboard'))
    : config.webServer,
});
