import { test, expect } from '@playwright/test';
import { loginAsAgent, loginAsLO } from './fixtures';

// Realtor buying stage and the LO card, on mock Salesforce (see mock.ts). David Lee starts at
// Touring Homes, set by Test Agent; John Smith has no stage. Serial, because the realtor test
// moves John Smith and the LO test reads it after. global-setup resets the mock first.
test.describe.configure({ mode: 'serial' });

test.describe('Realtor stage and LO card (mock Salesforce)', () => {
  test('the realtor sees her LO and moves a buyer through the stages', async ({ page }) => {
    await loginAsAgent(page);
    await page.locator('tbody tr', { hasText: 'David Lee' }).click();
    const panel = page.getByTestId('contact-panel');

    const stage = panel.getByTestId('stage');
    await expect(stage.getByTestId('stage-current')).toHaveText('Touring Homes', { timeout: 5_000 });
    await expect(stage).toContainText('3 of 6');
    await expect(stage).toContainText('Next: Making Offers');

    const lo = panel.getByTestId('loan-officer');
    await expect(lo).toContainText('Your loan officer');
    await expect(lo).toContainText('Test LO');
    await expect(lo.getByRole('link', { name: /lo@test\.com/ })).toHaveAttribute('href', 'mailto:lo@test.com');
    await expect(panel.getByTestId('contact-actions').getByRole('link', { name: /^Call David Lee/ })).toBeVisible();

    await page.locator('tbody tr', { hasText: 'John Smith' }).click();
    await expect(stage.getByTestId('stage-current')).toHaveText('Not set yet', { timeout: 5_000 });
    await stage.getByRole('button', { name: 'Set the stage' }).click();
    await stage.getByRole('button', { name: 'Realty Consultation' }).click();
    await expect(stage.getByTestId('stage-current')).toHaveText('Realty Consultation');
    await expect(stage).toContainText('2 of 6');
    await expect(stage).toContainText('by Test Agent');
    // The change is in the shared notes too, so the LO sees it in Salesforce
    await expect(panel.getByTestId('notes')).toContainText('Stage: Realty Consultation');

    await page.reload();
    await page.locator('tbody tr', { hasText: 'John Smith' }).click();
    await expect(stage.getByTestId('stage-current')).toHaveText('Realty Consultation', { timeout: 5_000 });
  });

  test('the LO reads the stage but cannot change it, and gets no card of themselves', async ({ page }) => {
    await loginAsLO(page);
    await page.locator('tbody tr', { hasText: 'John Smith' }).click();
    const panel = page.getByTestId('contact-panel');
    await expect(panel.getByTestId('stage-current')).toHaveText('Realty Consultation', { timeout: 5_000 });
    await expect(panel.getByTestId('stage').getByRole('button')).toHaveCount(0);
    await expect(panel.getByTestId('loan-officer')).toHaveCount(0);
  });
});
