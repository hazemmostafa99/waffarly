import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  outputDir: './test-results/cash-custody',
  workers: 1,
  timeout: 30000,
  expect: { timeout: 8000 },
  use: {
    channel: process.env.CI ? 'chromium' : 'chrome',
    headless: true,
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  projects: [
    {
      name: 'cash-owner-desktop',
      testMatch: 'merchant-pos-cash.spec.ts',
      use: { baseURL: 'http://127.0.0.1:5294', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'cash-owner-mobile',
      testMatch: 'merchant-pos-cash.spec.ts',
      use: { baseURL: 'http://127.0.0.1:5294', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'cash-pos-desktop',
      testMatch: 'pos-shift.spec.ts',
      use: { baseURL: 'http://127.0.0.1:5295', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'cash-pos-mobile',
      testMatch: 'pos-shift.spec.ts',
      use: { baseURL: 'http://127.0.0.1:5295', viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command:
        'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5294 --strictPort',
      cwd: './apps/merchant-dashboard',
      url: 'http://127.0.0.1:5294',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5295 --strictPort',
      cwd: './apps/pos',
      url: 'http://127.0.0.1:5295',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
