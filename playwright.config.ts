import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  workers: 1,
  timeout: 30_000,
  use: {
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command:
        'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5273 --strictPort',
      cwd: './apps/super-admin',
      url: 'http://127.0.0.1:5273',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5274 --strictPort',
      cwd: './apps/merchant-dashboard',
      url: 'http://127.0.0.1:5274',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5275 --strictPort',
      cwd: './apps/pos',
      url: 'http://127.0.0.1:5275',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100',
      cwd: './apps/storefront',
      url: 'http://127.0.0.1:3100',
      env: { WAFFARLY_UI_TEST: '1' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
