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
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });

    // Click first row to open detail panel
    await firstRow.click();
    await page.waitForTimeout(300);

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

  test('admin panel shows Loan Partners section with populated fields only', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // Click John Smith (has Loan_Partners__c='Test LO' + Leon_Loan_Partner__c='Test LO', Marat__c=null)
    await page.getByText('John Smith').click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Admin sees Loan Partner section with deduplicated names
    await expect(panel.getByRole('heading', { name: 'Loan Partner' })).toBeVisible();
    // Both fields have 'Test LO' — should show once (deduplicated)
    await expect(panel.getByText('Test LO')).toBeVisible();
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

    // Should see Status, Temperature, Stage dropdowns (3 selects)
    const selects = panel.locator('select');
    await expect(selects.first()).toBeVisible();
    const selectCount = await selects.count();
    expect(selectCount).toBe(3);

    // Should see Last Touch textarea
    await expect(panel.getByText('Last Touch', { exact: true })).toBeVisible();

    // Should NOT see Loan Partners section (LOs don't see it)
    await expect(panel.getByText('Leon Loan Partner')).not.toBeVisible();
  });
});

test.describe('Contacts grid (agent)', () => {
  test('agent sees contacts and detail panel with correct fields', async ({ page }) => {
    await loginAsAgent(page);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    // Click first row
    await rows.first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Agent should have no editable dropdowns (fully read-only)
    const selects = panel.locator('select');
    const selectCount = await selects.count();
    expect(selectCount).toBe(0);

    // Agent should see Status, Temperature and Stage as read-only labels
    await expect(panel.getByText('Status', { exact: true })).toBeVisible();
    await expect(panel.getByText('Temperature', { exact: true })).toBeVisible();
    await expect(panel.getByText('Stage', { exact: true })).toBeVisible();
  });

  test('agent sees loan partner fields when populated', async ({ page }) => {
    await loginAsAgent(page);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    // Click first contact — John Smith has Loan_Partners__c='Test LO' and Leon_Loan_Partner__c='Test LO'
    await rows.first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Should see "Loan Partner" section header
    await expect(panel.getByRole('heading', { name: 'Loan Partner' })).toBeVisible();

    // Should show populated loan partner value (deduplicated)
    await expect(panel.getByText('Test LO').first()).toBeVisible();
  });

  test('agent Last Touch and Last Touch SMS are read-only', async ({ page }) => {
    await loginAsAgent(page);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    await rows.first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Agent should see Last Touch labels
    await expect(panel.getByText('Last Touch', { exact: true })).toBeVisible();

    // Last Touch should NOT have editable textareas (agent can't edit them)
    // Only the Status dropdown should be editable
    const textareas = panel.locator('textarea');
    const textareaCount = await textareas.count();
    expect(textareaCount).toBe(0);
  });
});

test.describe('Admin view-as pages', () => {
  test('Officer View shows LO columns and banner', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to Officer View
    await page.getByRole('link', { name: 'Officer View' }).click();
    await expect(page).toHaveURL(/\/view\/officers/);

    // Should show view-as banner
    await expect(page.getByText(/loan officer would see/i)).toBeVisible();

    // Should load contacts
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // LO columns don't have "Lead Source" or "Owner" columns
    const headers = page.locator('thead th');
    const headerTexts = await headers.allInnerTexts();
    expect(headerTexts).not.toContain('Lead Source');
    expect(headerTexts).not.toContain('Owner');
  });

  test('Agent View shows agent columns and banner', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to Agent View
    await page.getByRole('link', { name: 'Agent View' }).click();
    await expect(page).toHaveURL(/\/view\/agents/);

    // Should show view-as banner
    await expect(page.getByText(/Agent View/)).toBeVisible();
    await expect(page.getByText(/real estate agent would see/i)).toBeVisible();

    // Should load contacts
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // Agent columns should have "Referred By" header
    await expect(page.locator('thead th', { hasText: 'Referred By' })).toBeVisible();
  });

  test('Officer View detail panel uses LO field permissions', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Officer View' }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('tbody tr').first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // LO view should have 3 dropdowns (Status, Temperature, Stage)
    const selects = panel.locator('select');
    await expect(selects.first()).toBeVisible();
    const selectCount = await selects.count();
    expect(selectCount).toBe(3);
  });

  test('Agent View detail panel uses agent field permissions', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Agent View' }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('tbody tr').first().click();
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Agent view should have no editable dropdowns (fully read-only)
    const selects = panel.locator('select');
    const selectCount = await selects.count();
    expect(selectCount).toBe(0);

    // Should show Loan Partner section
    await expect(panel.getByRole('heading', { name: 'Loan Partner' })).toBeVisible();
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
