/**
 * `npm run reset:staging`: run the staging reset by hand (DB seed users + mock Salesforce).
 * global-setup.ts only exports the reset for Playwright, so running that file does nothing.
 * The staging server must be running, because the mock data lives in its memory.
 */
import globalSetup from './global-setup.js';

globalSetup().catch((e) => {
  console.error(e);
  process.exit(1);
});
