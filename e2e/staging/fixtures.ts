import type { Page } from '@playwright/test';

// Test credentials (must match seed-staging.ts)
export const TEST_ADMIN = {
  email: 'test-admin@test.com',
  password: 'test1234',
  name: 'Test Admin',
};

export const TEST_LO = {
  email: 'test-lo@test.com',
  accessCode: 'TESTLO1234',
  name: 'Test LO',
};

export const TEST_AGENT = {
  email: 'test-agent@test.com',
  accessCode: 'TESTAGENT1234',
  name: 'Test Agent',
};

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Admin' }).click();
  await page.getByLabel('Email').fill(TEST_ADMIN.email);
  await page.getByLabel('Password').fill(TEST_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('table').waitFor({ state: 'visible', timeout: 15_000 });
}

export async function loginAsLO(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Loan Officer' }).click();
  await page.getByLabel('Email').fill(TEST_LO.email);
  await page.getByLabel('Access Code').fill(TEST_LO.accessCode);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('table').waitFor({ state: 'visible', timeout: 15_000 });
}

export async function loginAsAgent(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Agent' }).click();
  await page.getByLabel('Email').fill(TEST_AGENT.email);
  await page.getByLabel('Access Code').fill(TEST_AGENT.accessCode);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('table').waitFor({ state: 'visible', timeout: 15_000 });
}
