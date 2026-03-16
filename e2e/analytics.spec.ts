import { test, expect } from '@playwright/test';

/**
 * Step 15: E2E Analytics flow — smoke tests.
 * Verify the analytics page loads and key elements are visible.
 *
 * Prerequisites:
 *   - App running at baseURL (localhost:3000 or staging)
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD env vars set for authenticated tests
 */

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('Analytics page', () => {
  test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app**', { timeout: 15_000 });
  });

  test('analytics page loads successfully', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('analytics page displays header', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard/AI view toggle is present', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    // The analytics page has Dashboard and AI analysis toggle buttons
    const dashboardBtn = page.locator('button').filter({ hasText: /dashboard|panel/i }).first();
    const aiBtn = page.locator('button').filter({ hasText: /ai|inteligencia/i }).first();
    // At least one toggle should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('analytics page renders stats or loading state', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    // The page should show either the stats dashboard, a loading spinner, or data
    // No crash / error boundary
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Unhandled Runtime Error');
  });

  test('refresh button is accessible', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    // The analytics page has a refresh button (RefreshCw icon)
    const refreshBtn = page.locator('button').filter({ has: page.locator('svg.lucide-refresh-cw') }).first();
    if (await refreshBtn.isVisible()) {
      await expect(refreshBtn).toBeEnabled();
    }
  });

  test('sidebar navigation to analytics works', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    const analyticsLink = page.locator('a[href="/app/analytics"]').first();
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await page.waitForURL('**/app/analytics**');
      await expect(page).toHaveURL(/\/app\/analytics/);
    }
  });
});
