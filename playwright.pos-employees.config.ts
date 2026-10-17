import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  testMatch: /pos-employees\.spec\.ts/,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1365, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5274 --strictPort',
      cwd: './apps/merchant-dashboard',
      url: 'http://127.0.0.1:5274',
      env: { ...process.env, VITE_API_BASE_URL: 'http://127.0.0.1:4000' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5275 --strictPort',
      cwd: './apps/pos',
      url: 'http://127.0.0.1:5275',
      env: { ...process.env, VITE_API_BASE_URL: 'http://127.0.0.1:4000' },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
