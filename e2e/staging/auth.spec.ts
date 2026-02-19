import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsLO, loginAsAgent, TEST_ADMIN, TEST_LO, TEST_AGENT } from './fixtures';

test.describe('Auth flows', () => {
  test('admin can login with email + password', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage LOs' })).toBeVisible();
  });

  test('loan officer can login with email + access code', async ({ page }) => {
    await loginAsLO(page);
    await expect(page.locator('table')).toBeVisible();
    // LO should NOT see admin nav links
    await expect(page.getByRole('link', { name: 'Manage LOs' })).not.toBeVisible();
  });

  test('agent can login with email + access code', async ({ page }) => {
    await loginAsAgent(page);
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage LOs' })).not.toBeVisible();
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByLabel('Email').fill(TEST_ADMIN.email);
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/failed|invalid|error/i)).toBeVisible({ timeout: 5_000 });
  });

  test('unauthenticated user redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout redirects to login', async ({ page }) => {
    await loginAsAdmin(page);
    // Click the last button in header (logout)
    await page.locator('header').getByRole('button').last().click();
    await expect(page).toHaveURL(/\/login/);
  });
});
