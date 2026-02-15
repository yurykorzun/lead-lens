import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'leon@leonbelov.com';
const ADMIN_PASSWORD = 'test1234';

test.describe('Admin basic flow', () => {
  test('login, browse contacts, open detail panel, edit and save', async ({ page }) => {
    // 1. Navigate to app — should redirect to login
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Lead Lens' })).toBeVisible();

    // 2. Login as admin
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // 3. Verify dashboard loaded — table and filters visible
    await expect(page.getByPlaceholder('Search')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('table')).toBeVisible();

    // Verify admin nav links
    await expect(page.getByRole('link', { name: 'Contacts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage LOs' })).toBeVisible();

    // 4. Verify contacts loaded (at least one row)
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // 5. Click first contact row — detail panel opens
    const firstRowName = await rows.first().locator('td').first().innerText();
    await rows.first().click();

    // Verify detail panel appeared with contact name
    const panel = page.locator('div.border-l');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2 })).toContainText(firstRowName.trim());

    // Verify Save button exists but is disabled (no changes yet)
    const saveButton = panel.getByRole('button', { name: /Save/ });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();

    // 6. Change a dropdown value (Status)
    const statusSelect = panel.locator('select').first();
    await statusSelect.waitFor({ state: 'visible' });
    const options = await statusSelect.locator('option').allInnerTexts();
    // Pick an option that isn't the current value or "Select..."
    const currentValue = await statusSelect.inputValue();
    const newOption = options.find(o => o !== 'Select...' && o !== currentValue) || options[1];
    await statusSelect.selectOption({ label: newOption });

    // Save button should now be enabled
    await expect(saveButton).toBeEnabled();

    // 7. Click Save
    await saveButton.click();

    // Save button should return to disabled after save completes
    await expect(saveButton).toBeDisabled({ timeout: 10_000 });

    // 8. Close panel via X button
    await panel.getByRole('button', { name: '' }).first().click();
    await expect(panel).not.toBeVisible();

    // 9. Use search filter
    await page.getByPlaceholder('Search').fill('a');
    // Table should still have rows (or show "No contacts found")
    await page.waitForTimeout(500);
    await expect(page.locator('tbody tr').first()).toBeVisible();

    // Clear search
    await page.getByPlaceholder('Search').clear();
  });

  test('admin can navigate to Manage LOs page', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });

    // Navigate to Manage LOs
    await page.getByRole('link', { name: 'Manage LOs' }).click();
    await expect(page).toHaveURL(/\/admin/);

    // Verify admin page loaded
    await expect(page.getByRole('button', { name: /Add Loan Officer/ })).toBeVisible();
  });

  test('logout redirects to login', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });

    // Logout
    await page.locator('header').getByRole('button').last().click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Auth guards', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/failed|invalid|error/i)).toBeVisible({ timeout: 5_000 });
  });
});
