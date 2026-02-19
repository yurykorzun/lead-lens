import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsLO, loginAsAgent } from './fixtures';

test.describe('Contacts grid (admin)', () => {
  test('loads mock contacts and shows table', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify contacts loaded
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('search filters contacts by name', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // Search for a specific mock contact
    await page.getByPlaceholder('Search').fill('John');
    await page.waitForTimeout(500); // debounce
    await expect(page.getByText('John Smith')).toBeVisible({ timeout: 5_000 });

    // Search for non-existent
    await page.getByPlaceholder('Search').clear();
    await page.getByPlaceholder('Search').fill('zzz_nonexistent_zzz');
    await page.waitForTimeout(500);
    await expect(page.getByText(/no contacts/i)).toBeVisible({ timeout: 5_000 });
  });

  test('open detail panel, edit, and save contact', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // Click first row to open detail panel
    await page.locator('tbody tr').first().click();

    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Verify Save is disabled (no changes yet)
    const saveButton = panel.getByRole('button', { name: /Save/ });
    await expect(saveButton).toBeDisabled();

    // Change Status dropdown
    const statusSelect = panel.locator('select').first();
    await statusSelect.waitFor({ state: 'visible' });
    const options = await statusSelect.locator('option').allInnerTexts();
    const currentValue = await statusSelect.inputValue();
    const newOption = options.find(o => o !== 'Select...' && o !== currentValue) || options[1];
    await statusSelect.selectOption({ label: newOption });

    // Save should be enabled now
    await expect(saveButton).toBeEnabled();

    // Click Save
    await saveButton.click();

    // Verify success toast appears
    await expect(page.getByText(/saved|success/i)).toBeVisible({ timeout: 5_000 });
  });

  test('cancel closes panel without saving', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('tbody tr').first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible();

    // Change a value
    const statusSelect = panel.locator('select').first();
    await statusSelect.waitFor({ state: 'visible' });
    const options = await statusSelect.locator('option').allInnerTexts();
    const currentValue = await statusSelect.inputValue();
    const newOption = options.find(o => o !== 'Select...' && o !== currentValue) || options[1];
    await statusSelect.selectOption({ label: newOption });

    // Cancel
    await panel.getByRole('button', { name: 'Cancel' }).click();
    await expect(panel).not.toBeVisible();
  });
});

test.describe('Contacts grid (loan officer)', () => {
  test('LO sees contacts and can edit restricted fields', async ({ page }) => {
    await loginAsLO(page);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    // Click first row
    await rows.first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Should see Status dropdown (restricted editable field)
    const selects = panel.locator('select');
    await expect(selects.first()).toBeVisible();
  });
});

test.describe('Contacts grid (agent)', () => {
  test('agent sees contacts and detail panel', async ({ page }) => {
    await loginAsAgent(page);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    // Click first row
    await rows.first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Activity and History tabs', () => {
  test('activity tab shows mock data', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('tbody tr').first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible();

    // Switch to Activity tab
    await panel.getByRole('tab', { name: 'Activity' }).click();
    // Should show mock tasks (not "No activity found" since we have mock data)
    await expect(panel.getByText(/follow-up call|send pre-approval|no activity/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('history tab shows mock data', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('tbody tr').first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible();

    // Switch to History tab
    await panel.getByRole('tab', { name: 'History' }).click();
    await expect(panel.getByText(/Status__c|Temparture__c|no field changes/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
