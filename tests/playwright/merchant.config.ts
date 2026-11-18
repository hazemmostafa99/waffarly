import { workspacePath } from './paths.js';
import { defineConfig } from '@playwright/test';
import base from './base.config.js';

export default defineConfig({
  outputDir: workspacePath('test-results'),
  ...base,
  testMatch: /merchant-.*\.spec\.ts/,
  use: { ...base.use, channel: process.env.CI ? 'chromium' : 'chrome' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5274 --strictPort',
    cwd: workspacePath('apps/merchant-dashboard'),
    url: 'http://127.0.0.1:5274',
    reuseExistingServer: !process.env.CI,
  },
});
