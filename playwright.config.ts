import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/staging',
  timeout: 30_000,
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:5174',
    screenshot: 'only-on-failure',
  },
});
