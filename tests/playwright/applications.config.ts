import { workspacePath } from './paths.js';
import { defineConfig } from '@playwright/test';
import base from './base.config.js';

export default defineConfig({
  outputDir: workspacePath('test-results'),
  ...base,
  testMatch: 'super-admin-applications.spec.ts',
  webServer: Array.isArray(base.webServer) ? base.webServer.slice(0, 1) : base.webServer,
});
