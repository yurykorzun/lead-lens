/**
 * Playwright global teardown for staging tests.
 * Cleans up the staging DB after tests complete.
 */
import { resetStagingDb } from './global-setup.js';

export default async function globalTeardown() {
  console.log('Cleaning up staging database...');
  await resetStagingDb();
  console.log('Staging database cleanup complete.');
}
