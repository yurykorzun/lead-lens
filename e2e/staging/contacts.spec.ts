import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, loginAsLO, loginAsAgent } from './fixtures';

// Lead Lens is read-only on lgc-ci fields: no selects, no Save, no Activity or History, and
// none of the team's internal notes. The only box is the realtor note (Realtor_Note__c).
async function expectReadOnlyPanel(page: Page) {
  const panel = page.getByTestId('contact-panel');
  await expect(panel).toBeVisible({ timeout: 5_000 });
  await expect(panel.getByText('Status', { exact: true })).toBeVisible();
  await expect(panel.locator('select')).toHaveCount(0);
  await expect(panel.locator('textarea')).toHaveCount(1);
  await expect(panel.getByLabel('New note')).toBeVisible();
  await expect(panel.getByRole('button', { name: /Save/ })).toHaveCount(0);
  await expect(panel.getByRole('tab')).toHaveCount(0);
  await expect(panel.getByText(/Last Touch|Description/)).toHaveCount(0);
  return panel;
}

test.describe('Realtor notes (Realtor_Note__c, mock Salesforce)', () => {
  test('the realtor adds a note and the loan officer reads it', async ({ page, browser }) => {
    const text = `Spoke with John, docs by Friday ${Date.now().toString(36)}`;

    await loginAsAgent(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    // The grid row, not her open-steps list above it, which also names the borrower
    await page.locator('tbody tr', { hasText: 'John Smith' }).click();
    let panel = page.getByTestId('contact-panel');
    // Mock notes live in the staging server's memory, so an earlier run may have left some
    await expect(panel.getByText('Loading notes…')).toHaveCount(0, { timeout: 5_000 });
    await expect(panel.getByRole('button', { name: 'Add note' })).toBeDisabled();
    await panel.getByLabel('New note').fill(text);
    await panel.getByRole('button', { name: 'Add note' }).click();
    const mine = panel.getByTestId('note').filter({ hasText: text });
    // Salesforce keeps no Lead Lens user Id, so her own note shows her name, not "You"
    await expect(mine).toContainText('Test Agent');
    await expect(panel.getByLabel('New note')).toHaveValue('');

    // A separate browser for the loan officer, the way they would use it
    const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const lo = await context.newPage();
    await loginAsLO(lo);
    await expect(lo.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    await lo.locator('tbody tr', { hasText: 'John Smith' }).click();
    panel = lo.getByTestId('contact-panel');
    const seen = panel.getByTestId('note').filter({ hasText: text });
    await expect(seen).toContainText('Test Agent');
    await expect(seen).toContainText('Realtor');
    await expect(seen.getByTestId('note-source')).toHaveText('in Lead Lens');
    await context.close();
  });

  test("the realtor reads the LO's Salesforce note on a converted lead", async ({ page }) => {
    await loginAsAgent(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('tbody tr', { hasText: 'Jane Doe' }).click();
    const panel = page.getByTestId('contact-panel');
    const lo = panel.getByTestId('note').filter({ hasText: 'Pre-approval letter is out' });
    await expect(lo).toContainText('Test LO');
    await expect(lo.getByTestId('note-source')).toHaveText('in Salesforce');
    await expect(panel.getByTestId('note').filter({ hasText: 'Saw two houses' })).toBeVisible();
  });
});

test.describe('Contacts grid (admin)', () => {
  test('loads borrower rows', async ({ page }) => {
    await loginAsAdmin(page);
    const rows = page.locator('tbody tr');
    // Retries: the loading skeleton draws 10 placeholder rows first
    await expect(rows).toHaveCount(8, { timeout: 15_000 });
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
    await expect(page.getByText(/columns a loan officer sees/i)).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const headerTexts = await page.locator('thead th').allInnerTexts();
    expect(headerTexts).not.toContain('Lead Source');
    expect(headerTexts).not.toContain('Owner');
  });

  test('Agent View shows agent columns and banner', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Agent View' }).click();
    await expect(page).toHaveURL(/\/view\/agents/);
    await expect(page.getByText(/columns a realtor sees/i)).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    // Her rows are all hers, so Referred By would only repeat her own name
    await expect(page.locator('thead th', { hasText: 'Referred By' })).toHaveCount(0);
    await expect(page.locator('thead th', { hasText: 'Lead Source' })).toBeVisible();

    await page.locator('tbody tr').first().click();
    await expectReadOnlyPanel(page);
  });

  test('Agent View as one realtor shows exactly her rows, without a note box', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Agent View' }).click();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(8, { timeout: 15_000 });
    await expect(page.getByTestId('open-tasks')).toHaveCount(0);

    await page.getByLabel('View as realtor').selectOption({ label: 'Test Agent' });
    await expect(page).toHaveURL(/as=/);
    await expect(page.getByText(/exactly the borrowers this realtor sees/i)).toBeVisible();
    await expect(rows).toHaveCount(6, { timeout: 15_000 });
    await expect(page.getByText('Sam Other')).toHaveCount(0);

    // Her To do: the next step on each borrower, nothing to mark done
    const todo = page.getByTestId('open-tasks');
    await expect(todo.getByTestId('task')).toHaveCount(2, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /mark done/i })).toHaveCount(0);

    await rows.filter({ hasText: 'Jane Doe' }).click();
    const panel = page.getByTestId('contact-panel');
    await expect(panel.getByTestId('notes')).toBeVisible();
    await expect(panel.getByLabel('New note')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: /mark done/i })).toHaveCount(0);

    // Reload keeps the person
    await page.reload();
    await expect(rows).toHaveCount(6, { timeout: 15_000 });
  });
});
