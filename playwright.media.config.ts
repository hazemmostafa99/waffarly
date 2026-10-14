import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: ['merchant-media.spec.ts'],
  webServer: Array.isArray(config.webServer)
    ? config.webServer.filter((server) => server.cwd === './apps/merchant-dashboard')
    : config.webServer,
});
