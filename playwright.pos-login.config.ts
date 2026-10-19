import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  testMatch: 'pos-login.spec.ts',
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    channel: 'chrome',
    headless: true,
    baseURL: 'http://127.0.0.1:5282',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5282 --strictPort',
    cwd: './apps/pos',
    url: 'http://127.0.0.1:5282',
    env: { ...process.env, NODE_ENV: 'development' },
    reuseExistingServer: !process.env.CI,
  },
});
