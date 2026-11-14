import { workspacePath } from './paths.js';
import { defineConfig } from '@playwright/test';
import base from './base.config.js';

export default defineConfig({
  outputDir: workspacePath('test-results'),
  ...base,
  testMatch: /storefront-modifiers\.spec\.ts/,
  use: { ...base.use, channel: process.env.CI ? 'chromium' : 'chrome' },
  webServer: [
    {
      cwd: workspacePath(),
      command: 'node tests/ui/support/modifier-api.mjs',
      url: 'http://127.0.0.1:4019/health',
      reuseExistingServer: false,
    },
    {
      command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101',
      cwd: workspacePath('apps/storefront'),
      url: 'http://127.0.0.1:3101',
      env: { NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4019' },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
