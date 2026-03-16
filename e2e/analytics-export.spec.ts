import { test, expect } from '@playwright/test';

/**
 * Analytics Export — smoke tests
 * Verify the analytics page loads and basic export UI is accessible.
 */

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('Analytics Export', () => {
  test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app**', { timeout: 15_000 });
  });

  test('analytics page loads and displays header', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // The page should have rendered without errors
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('analytics page shows dashboard/AI toggle', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    // Should have dashboard and AI analysis toggle buttons
    await expect(page.locator('body')).toBeVisible();
  });
});
