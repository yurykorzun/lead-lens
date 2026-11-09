import { test, expect } from '@playwright/test';
import { loginAsAgent, loginAsLO } from './fixtures';

// Realtor steps (call 1/2/3, showing 1/2/3) on mock Salesforce, see mock.ts. Test Agent has
// Call 1, Call 2 and Showing 1 on John Smith and Call 1 on Jane Doe. John Smith also has an
// LP task with no realtor stamp and another realtor's Call 1, and her Call 3 on Sam Other is
// out of her scope because the other agent refers him now.
// Serial, because the last test marks a step done. global-setup resets the mock first.
test.describe.configure({ mode: 'serial' });

test.describe('Realtor steps (mock Salesforce)', () => {
  test('the LO sees every realtor step on a borrower, read-only, and no LP task', async ({ page }) => {
    await loginAsLO(page);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    // Her to-do list is only on a realtor's own dashboard
    await expect(page.getByTestId('open-tasks')).toHaveCount(0);

    await page.locator('tbody tr', { hasText: 'John Smith' }).click();
    const steps = page.getByTestId('contact-panel').getByTestId('tasks');
    await expect(steps.getByTestId('task')).toHaveCount(4, { timeout: 5_000 });
    await expect(steps.getByTestId('task').filter({ hasText: 'Realtor: Call 1' })).toHaveCount(2);
    await expect(steps.getByText('Follow up on pre-approval')).toHaveCount(0);
    await expect(steps.getByRole('button', { name: /mark done/i })).toHaveCount(0);
  });

  test('the realtor sees only the next open step on each borrower in scope, earliest first', async ({ page }) => {
    await loginAsAgent(page);
    const todo = page.getByTestId('open-tasks');
    await expect(todo).toBeVisible({ timeout: 15_000 });
    // John Smith has Call 1, Call 2 and Showing 1 open - only Call 1 is listed
    await expect(todo.getByRole('heading')).toHaveText('To do (2)');
    await expect(todo.getByTestId('task')).toHaveCount(2);
    await expect(todo.getByTestId('task').first()).toContainText('Realtor: Call 1 · John Smith');
    await expect(todo.getByTestId('task').last()).toContainText('Realtor: Call 1 · Jane Doe');
    await expect(todo.getByText('Realtor: Call 2')).toHaveCount(0);
    await expect(todo.getByRole('button', { name: /show all/i })).toHaveCount(0);
    await expect(todo.getByText('Sam Other')).toHaveCount(0);
    await expect(todo.getByText('Realtor: Call 3')).toHaveCount(0);
    await expect(todo.getByText('Follow up on pre-approval')).toHaveCount(0);

    await page.locator('tbody tr', { hasText: 'John Smith' }).click();
    const steps = page.getByTestId('contact-panel').getByTestId('tasks');
    // Hers only: not the other realtor's Call 1, not the LP's task
    await expect(steps.getByTestId('task')).toHaveCount(3, { timeout: 5_000 });
    await expect(steps.getByRole('button', { name: /mark done/i })).toHaveCount(3);
  });

  test('the realtor marks a step done and it stays done after a reload', async ({ page }) => {
    await loginAsAgent(page);
    const todo = page.getByTestId('open-tasks');
    await expect(todo.getByRole('heading')).toHaveText('To do (2)', { timeout: 15_000 });

    await page.locator('tbody tr', { hasText: 'John Smith' }).click();
    const steps = page.getByTestId('contact-panel').getByTestId('tasks');
    const call1 = steps.getByTestId('task').filter({ hasText: 'Realtor: Call 1' });
    await call1.getByRole('button', { name: /mark done/i }).click();

    await expect(call1).toContainText('Done');
    await expect(call1.getByRole('button', { name: /mark done/i })).toHaveCount(0);
    // John Smith's next step takes its place in To do
    await expect(todo.getByTestId('task').filter({ hasText: 'John Smith' })).toContainText('Realtor: Call 2');
    await expect(todo.getByRole('heading')).toHaveText('To do (2)');

    await page.reload();
    await expect(todo.getByTestId('task').filter({ hasText: 'John Smith' })).toContainText('Realtor: Call 2', { timeout: 15_000 });
    await page.locator('tbody tr', { hasText: 'John Smith' }).click();
    await expect(steps.getByTestId('task').filter({ hasText: 'Realtor: Call 1' })).toContainText('Done');
  });
});
