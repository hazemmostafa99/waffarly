import { defineConfig } from '@playwright/test';
import employeeConfig from './playwright.pos-employees.config';

export default defineConfig(employeeConfig, {
  testMatch: /(?:employee-roles|pos-employees)\.spec\.ts/,
  use: { channel: process.env.CI ? 'chromium' : 'chrome' },
});
