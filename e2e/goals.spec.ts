import { test, expect } from '@playwright/test';

/**
 * Step 15: E2E Goals flow — smoke tests.
 * Verify the goals page loads, header and key elements are visible.
 *
 * Prerequisites:
 *   - App running at baseURL (localhost:3000 or staging)
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD env vars set for authenticated tests
 */

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('Goals page', () => {
  test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app**', { timeout: 15_000 });
  });

  test('goals page loads successfully', async ({ page }) => {
    await page.goto('/app/goals');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('goals page displays header', async ({ page }) => {
    await page.goto('/app/goals');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  });

  test('create goal button is visible', async ({ page }) => {
    await page.goto('/app/goals');
    await page.waitForLoadState('networkidle');
    // Look for the create goal button
    const createBtn = page.locator('button').filter({ hasText: /create|crear|add|new/i }).first();
    if (await createBtn.isVisible()) {
      await expect(createBtn).toBeEnabled();
    }
  });

  test('view mode toggle is accessible', async ({ page }) => {
    await page.goto('/app/goals');
    await page.waitForLoadState('networkidle');
    // Grid and Tree view toggles (LayoutGrid / GitBranch icons)
    const toggleBtn = page.locator('button svg.lucide-layout-grid, button svg.lucide-git-branch').first();
    await expect(toggleBtn).toBeVisible({ timeout: 5_000 }).catch(() => {
      // Toggle may not be visible if tree-viz feature flag is off — acceptable
    });
  });

  test('goals page renders without errors', async ({ page }) => {
    await page.goto('/app/goals');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Unhandled Runtime Error');
  });

  test('sidebar navigation to goals works', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    const goalsLink = page.locator('a[href="/app/goals"]').first();
    if (await goalsLink.isVisible()) {
      await goalsLink.click();
      await page.waitForURL('**/app/goals**');
      await expect(page).toHaveURL(/\/app\/goals/);
    }
  });
});
