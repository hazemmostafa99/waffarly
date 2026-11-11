import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testMatch: 'super-admin-applications.spec.ts',
  webServer: Array.isArray(base.webServer) ? base.webServer.slice(0, 1) : base.webServer,
});
