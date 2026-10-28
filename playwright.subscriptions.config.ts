import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  testMatch: 'subscriptions.spec.ts',
  workers: 1,
  timeout: 30000,
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
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5283 --strictPort',
    cwd: './apps/super-admin',
    url: 'http://127.0.0.1:5283',
    reuseExistingServer: !process.env.CI,
  },
});
