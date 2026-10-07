import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, loginAsLO, loginAsAgent } from './fixtures';

// Lead Lens is read-only on lgc-ci: no selects, no textareas, no Save, no Activity or History
async function expectReadOnlyPanel(page: Page) {
  const panel = page.locator('div.border-l');
  await expect(panel).toBeVisible({ timeout: 5_000 });
  await expect(panel.getByText('Status', { exact: true })).toBeVisible();
  await expect(panel.locator('select')).toHaveCount(0);
  await expect(panel.locator('textarea')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /Save/ })).toHaveCount(0);
  await expect(panel.getByRole('tab')).toHaveCount(0);
  await expect(panel.getByText(/Last Touch|Description|Notes/)).toHaveCount(0);
  return panel;
}

test.describe('Contacts grid (admin)', () => {
  test('loads borrower rows', async ({ page }) => {
    await loginAsAdmin(page);
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    expect(await rows.count()).toBe(8);
  });

  test('search filters by name', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Search').fill('John');
    await page.waitForTimeout(500); // debounce
    await expect(page.getByText('John Smith')).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder('Search').clear();
    await page.getByPlaceholder('Search').fill('zzz_nonexistent_zzz');
    await page.waitForTimeout(500);
    await expect(page.getByText(/no contacts/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Client status filter shows only clients', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('select').first().selectOption({ label: 'Client' });
    await expect(page.locator('tbody tr')).toHaveCount(3, { timeout: 5_000 });
  });

  test('detail panel is read-only and links to Salesforce', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    await page.getByText('Maria Garcia').click();

    const panel = await expectReadOnlyPanel(page);
    await expect(panel.getByText('Loan Stage', { exact: true })).toBeVisible();
    await expect(panel.getByTitle('Open in Salesforce')).toHaveAttribute('href', /lightning\.force\.com\/lightning\/r\/Contact\//);

    await panel.getByRole('button', { name: 'Close' }).click();
    await expect(panel).not.toBeVisible();
  });
});

test.describe('Contacts grid (loan officer)', () => {
  test('LO sees only their own rows, read-only', async ({ page }) => {
    await loginAsLO(page);
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    expect(await rows.count()).toBe(6);
    await expect(page.getByText('Sam Other')).toHaveCount(0);

    await rows.first().click();
    const panel = await expectReadOnlyPanel(page);
    await expect(panel.getByTitle('Open in Salesforce')).toHaveCount(0);
  });
});

test.describe('Contacts grid (agent)', () => {
  test('agent sees only rows they referred, read-only, no notes', async ({ page }) => {
    await loginAsAgent(page);
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    expect(await rows.count()).toBe(6);
    await expect(page.getByText('Sam Other')).toHaveCount(0);
    await expect(page.getByText('Nina Volkova')).toHaveCount(0);

    await rows.first().click();
    const panel = await expectReadOnlyPanel(page);
    await expect(panel.getByText('Temperature', { exact: true })).toBeVisible();
    await expect(panel.getByTitle('Open in Salesforce')).toHaveCount(0);
  });

  test('the API response carries no note fields', async ({ page }) => {
    const response = page.waitForResponse(r => r.url().includes('/api/contacts') && r.request().method() === 'GET');
    await loginAsAgent(page);
    const body = await (await response).json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const row of body.data) {
      for (const key of ['message', 'description', 'lastTouch', 'lastTouchSms', 'notes']) {
        expect(row).not.toHaveProperty(key);
      }
    }
  });
});

test.describe('Admin view-as pages', () => {
  test('Officer View shows LO columns and banner', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Officer View' }).click();
    await expect(page).toHaveURL(/\/view\/officers/);
    await expect(page.getByText(/loan officer would see/i)).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const headerTexts = await page.locator('thead th').allInnerTexts();
    expect(headerTexts).not.toContain('Lead Source');
    expect(headerTexts).not.toContain('Owner');
  });

  test('Agent View shows agent columns and banner', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Agent View' }).click();
    await expect(page).toHaveURL(/\/view\/agents/);
    await expect(page.getByText(/real estate agent would see/i)).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('thead th', { hasText: 'Referred By' })).toBeVisible();

    await page.locator('tbody tr').first().click();
    await expectReadOnlyPanel(page);
  });
});
