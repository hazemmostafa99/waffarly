import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testMatch: /merchant-.*\.spec\.ts/,
  use: { ...base.use, channel: process.env.CI ? 'chromium' : 'chrome' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5274 --strictPort',
    cwd: './apps/merchant-dashboard',
    url: 'http://127.0.0.1:5274',
    reuseExistingServer: !process.env.CI,
  },
});
