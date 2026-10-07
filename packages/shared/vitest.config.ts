import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tsc copies __tests__ into dist, so skip it or every test runs twice
    exclude: ['**/node_modules/**', 'dist/**'],
    // Types and constants only since the Jungo field map went
    passWithNoTests: true,
  },
});
