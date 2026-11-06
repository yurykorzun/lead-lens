import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/staging',
  // Both files only export a function, so Playwright has to run them; `npm run reset:staging` uses reset.ts
  globalSetup: './e2e/staging/global-setup.ts',
  globalTeardown: './e2e/staging/global-teardown.ts',
  timeout: 30_000,
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:5174',
    screenshot: 'only-on-failure',
  },
});
