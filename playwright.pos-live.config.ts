import { defineConfig } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:4005';
const posOrigin = 'http://127.0.0.1:5290';

export default defineConfig({
  testDir: './tests/ui',
  testMatch: 'pos-live-e2e.spec.ts',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: {
    channel: process.env.CI ? 'chromium' : 'chrome',
    headless: true,
    baseURL: posOrigin,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node --import tsx src/main.ts',
      cwd: './apps/api',
      url: `${apiOrigin}/health`,
      env: {
        ...process.env,
        PORT: '4005',
        CORS_ORIGINS: posOrigin,
        DATABASE_URL: process.env.DATABASE_URL,
        NODE_ENV: 'test',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5290 --strictPort',
      cwd: './apps/pos',
      url: posOrigin,
      env: {
        ...process.env,
        VITE_API_BASE_URL: apiOrigin,
        NODE_ENV: 'development',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
