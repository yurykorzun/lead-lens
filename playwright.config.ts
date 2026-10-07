import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/staging',
  // global-setup.ts only exports a function, so running it with tsx in test:e2e did nothing
  globalSetup: './e2e/staging/global-setup.ts',
  timeout: 30_000,
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:5174',
    screenshot: 'only-on-failure',
  },
});
