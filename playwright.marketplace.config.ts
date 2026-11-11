import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/marketplace',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3105',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'laptop', use: { viewport: { width: 1024, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'small-mobile', use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3105',
    cwd: './apps/storefront',
    url: 'http://127.0.0.1:3105',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
