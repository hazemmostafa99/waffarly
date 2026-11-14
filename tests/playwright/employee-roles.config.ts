import { defineConfig } from '@playwright/test';
import employeeConfig from './pos-employees.config.js';

export default defineConfig(employeeConfig, {
  testMatch: /(?:employee-roles|pos-employees)\.spec\.ts/,
  use: { channel: process.env.CI ? 'chromium' : 'chrome' },
});
