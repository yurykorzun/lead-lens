import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures';

// Unique suffix to avoid collisions between test runs
const SUFFIX = Date.now().toString(36);

test.describe('Loan Officer management', () => {
  test('create, edit, disable, enable, and delete a loan officer', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Manage LOs' }).click();
    await expect(page).toHaveURL(/\/admin/);

    // Wait for table to load
    await expect(page.locator('thead')).toBeVisible({ timeout: 10_000 });

    // ── Create ──
    const loName = `E2E LO ${SUFFIX}`;
    const loEmail = `e2e-lo-${SUFFIX}@test.com`;

    await page.getByRole('button', { name: /Add Loan Officer/ }).click();
    await page.getByLabel('Name').fill(loName);
    await page.getByLabel('Email').fill(loEmail);
    await page.getByRole('button', { name: 'Create' }).click();

    // Access code modal should appear
    await expect(page.getByText(/access code/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /close|done|ok|×/i }).first().click();

    // Verify LO appears in table
    await expect(page.getByText(loName)).toBeVisible({ timeout: 5_000 });

    // ── Edit ──
    const row = page.locator('tr', { hasText: loName });
    await row.getByRole('button').click(); // open dropdown
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const editedName = `Edited LO ${SUFFIX}`;
    await page.getByLabel('Name').clear();
    await page.getByLabel('Name').fill(editedName);
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify name changed
    await expect(page.getByText(editedName)).toBeVisible({ timeout: 5_000 });

    // ── Disable ──
    const editedRow = page.locator('tr', { hasText: editedName });
    await editedRow.getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Disable' }).click();

    // Status should change to disabled
    await expect(editedRow.getByText('disabled')).toBeVisible({ timeout: 5_000 });

    // ── Enable ──
    await editedRow.getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Enable' }).click();
    await expect(editedRow.getByText('active')).toBeVisible({ timeout: 5_000 });

    // ── Delete ──
    page.on('dialog', dialog => dialog.accept());
    await editedRow.getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Verify removed from table
    await expect(page.getByText(editedName)).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Agent management', () => {
  test('create, edit, and delete an agent', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Manage Agents' }).click();
    await expect(page).toHaveURL(/\/agents/);

    await expect(page.locator('thead')).toBeVisible({ timeout: 10_000 });

    // ── Create ──
    const agentName = `E2E Agent ${SUFFIX}`;
    const agentEmail = `e2e-agent-${SUFFIX}@test.com`;

    await page.getByRole('button', { name: /Add Agent/ }).click();
    await page.getByLabel('Name').fill(agentName);
    await page.getByLabel('Email').fill(agentEmail);
    await page.getByRole('button', { name: 'Create' }).click();

    // Access code modal
    await expect(page.getByText(/access code/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /close|done|ok|×/i }).first().click();

    await expect(page.getByText(agentName)).toBeVisible({ timeout: 5_000 });

    // ── Delete ──
    page.on('dialog', dialog => dialog.accept());
    const row = page.locator('tr', { hasText: agentName });
    await row.getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByText(agentName)).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Admin management', () => {
  test('create and delete an admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Manage Admins' }).click();
    await expect(page).toHaveURL(/\/admins/);

    await expect(page.locator('thead')).toBeVisible({ timeout: 10_000 });

    // ── Create ──
    const adminName = `E2E Admin ${SUFFIX}`;
    const adminEmail = `e2e-admin-${SUFFIX}@test.com`;

    await page.getByRole('button', { name: /Add Admin/ }).click();
    await page.getByLabel('Name').fill(adminName);
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill('testpass123');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(adminName)).toBeVisible({ timeout: 5_000 });

    // ── Delete ──
    page.on('dialog', dialog => dialog.accept());
    const row = page.locator('tr', { hasText: adminName });
    await row.getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByText(adminName)).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Duplicate email handling', () => {
  test('creating LO with existing email shows error', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Manage LOs' }).click();
    await expect(page.locator('thead')).toBeVisible({ timeout: 10_000 });

    // Try to create a LO with the seed LO's email
    await page.getByRole('button', { name: /Add Loan Officer/ }).click();
    await page.getByLabel('Name').fill('Duplicate LO');
    await page.getByLabel('Email').fill('test-lo@test.com');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show error about existing email
    await expect(page.getByText(/already exists|duplicate/i)).toBeVisible({ timeout: 5_000 });
  });
});
