import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures';
import { MOCK_AGENT_CONTACT_ID } from '../../server/src/services/salesforce/mock.js';

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
    await page.getByLabel('Name', { exact: true }).fill(loName);
    await page.getByLabel('Email', { exact: true }).fill(loEmail);
    await page.getByRole('button', { name: 'Create' }).click();

    // Access code modal should appear
    await expect(page.getByText(/access code/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Done' }).click();

    // Verify LO appears in table
    await expect(page.getByText(loName)).toBeVisible({ timeout: 5_000 });

    // ── Edit ──
    const row = page.locator('tr', { hasText: loName });
    await row.getByRole('button').click(); // open dropdown
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const editedName = `Edited LO ${SUFFIX}`;
    await page.getByLabel('Name', { exact: true }).clear();
    await page.getByLabel('Name', { exact: true }).fill(editedName);
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
    await page.getByLabel('Name', { exact: true }).fill(agentName);
    await page.getByLabel('Email', { exact: true }).fill(agentEmail);

    // No Salesforce record yet: an agent created now would see nothing, so Create waits
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();

    // The namesake with the referrals comes first, the empty duplicate shows 0
    await page.getByLabel('Salesforce record').fill('test agent');
    const options = page.getByRole('option');
    await expect(options).toHaveCount(2, { timeout: 5_000 });
    await expect(options.first()).toContainText('Test Realty');
    await expect(options.last()).toContainText('0 borrowers');
    await options.first().click();
    await expect(page.getByTestId('realtor-selected')).toContainText(MOCK_AGENT_CONTACT_ID);
    // Picking a record keeps what was typed
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(agentName);

    await page.getByRole('button', { name: 'Create' }).click();

    // Access code modal
    await expect(page.getByText(/access code/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Done' }).click();

    const row = page.locator('tr', { hasText: agentName });
    await expect(row.getByText(MOCK_AGENT_CONTACT_ID)).toBeVisible({ timeout: 5_000 });

    // ── Delete ──
    page.on('dialog', dialog => dialog.accept());
    await row.getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByText(agentName)).not.toBeVisible({ timeout: 5_000 });
  });

  test('move an agent to another Salesforce record, never to none', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Manage Agents' }).click();
    await expect(page.locator('thead')).toBeVisible({ timeout: 10_000 });

    // Picking a record on an empty form fills the name and email from it
    await page.getByRole('button', { name: /Add Agent/ }).click();
    await page.getByLabel('Salesforce record').fill('other.agent@');
    await page.getByRole('option', { name: /Other Agent/ }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Other Agent');
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('other.agent@test.com');
    const agentName = `E2E Move Agent ${SUFFIX}`;
    await page.getByLabel('Name', { exact: true }).fill(agentName);
    await page.getByLabel('Email', { exact: true }).fill(`e2e-move-${SUFFIX}@test.com`);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(/access code/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Done' }).click();

    const row = page.locator('tr', { hasText: agentName });
    await expect(row.getByText('003MOCKAGENT0002AA')).toBeVisible({ timeout: 5_000 });

    // ── Edit shows the linked record, and Save waits while it is cleared ──
    await row.getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.getByTestId('realtor-selected')).toContainText('Other Agent');
    await page.getByRole('button', { name: /Change/ }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    // ── Moved to another record ──
    await page.getByLabel('Salesforce record').fill('test agent');
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(row.getByText(MOCK_AGENT_CONTACT_ID)).toBeVisible({ timeout: 5_000 });

    page.on('dialog', dialog => dialog.accept());
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
    await page.getByLabel('Name', { exact: true }).fill(adminName);
    await page.getByLabel('Email', { exact: true }).fill(adminEmail);
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
    await page.getByLabel('Name', { exact: true }).fill('Duplicate LO');
    await page.getByLabel('Email', { exact: true }).fill('test-lo@test.com');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should show error about existing email
    await expect(page.getByText(/already exists|duplicate/i)).toBeVisible({ timeout: 5_000 });
  });
});
