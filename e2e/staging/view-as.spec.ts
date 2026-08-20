import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsAgent, loginAsLO, TEST_AGENT, TEST_LO } from './fixtures';

/** Filter the manager list down to one person — other specs leave rows behind. */
async function openViewFor(page: import('@playwright/test').Page, navLabel: string, name: string) {
  // Navigate in-app rather than page.goto — a hard reload re-runs the auth
  // verify round-trip and makes these specs needlessly slow and flaky.
  await page.getByRole('link', { name: navLabel, exact: true }).click();
  await page.getByPlaceholder(/Search by name or email/i).fill(name);
  await page.getByRole('link', { name, exact: true }).click();
}

/** Drop the current session so the next login is not skipped by the redirect. */
async function signOut(page: import('@playwright/test').Page) {
  await page.evaluate(() => window.localStorage.clear());
}

test.describe('View as a specific user', () => {
  test('admin opens an agent view by clicking the name in Manage Agents', async ({ page }) => {
    await loginAsAdmin(page);
    await openViewFor(page, 'Manage Agents', TEST_AGENT.name);

    await expect(page).toHaveURL(/\/view\/agents\/[0-9a-f-]{36}$/);
    await expect(page.getByText('viewing as')).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to Manage Agents/ })).toBeVisible();
  });

  test('admin opens a loan officer view by clicking the name in Manage LOs', async ({ page }) => {
    await loginAsAdmin(page);
    await openViewFor(page, 'Manage LOs', TEST_LO.name);

    await expect(page).toHaveURL(/\/view\/officers\/[0-9a-f-]{36}$/);
    await expect(page.getByText('viewing as')).toBeVisible();
  });

  test('the preview shows exactly the rows the agent sees on a real login', async ({ page }) => {
    await loginAsAgent(page);
    await page.waitForLoadState('networkidle');
    const ownRows = await page.locator('table tbody tr').count();
    expect(ownRows).toBeGreaterThan(0);

    await signOut(page);
    await loginAsAdmin(page);
    await openViewFor(page, 'Manage Agents', TEST_AGENT.name);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr')).toHaveCount(ownRows);
  });

  test('the preview shows exactly the rows the loan officer sees on a real login', async ({ page }) => {
    await loginAsLO(page);
    await page.waitForLoadState('networkidle');
    const ownRows = await page.locator('table tbody tr').count();
    expect(ownRows).toBeGreaterThan(0);

    await signOut(page);
    await loginAsAdmin(page);
    await openViewFor(page, 'Manage LOs', TEST_LO.name);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr')).toHaveCount(ownRows);
  });

  test('view-as is read-only — the detail panel offers no Save', async ({ page }) => {
    await loginAsAdmin(page);
    await openViewFor(page, 'Manage Agents', TEST_AGENT.name);
    await page.waitForLoadState('networkidle');
    await page.locator('table tbody tr').first().click();

    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });
});
