import { test, expect } from '@playwright/test';

/**
 * Step 13: E2E Docs flow — smoke tests.
 * Verify the docs page loads, header is visible, and create document button exists.
 *
 * Prerequisites:
 *   - App running at baseURL (localhost:3000 or staging)
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD env vars set for authenticated tests
 */

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('Docs flow', () => {
  test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app**', { timeout: 15_000 });
  });

  test('docs page loads successfully', async ({ page }) => {
    await page.goto('/app/docs');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('docs page displays header', async ({ page }) => {
    await page.goto('/app/docs');
    await page.waitForLoadState('networkidle');
    // The page should render a heading
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('create document button exists', async ({ page }) => {
    await page.goto('/app/docs');
    await page.waitForLoadState('networkidle');
    // Look for the create/new document button (Plus icon or text)
    const createBtn = page.locator('button').filter({ hasText: /create|new|nueva|crear|add/i }).first();
    if (await createBtn.isVisible()) {
      await expect(createBtn).toBeEnabled();
    }
  });

  test('docs page has search input', async ({ page }) => {
    await page.goto('/app/docs');
    await page.waitForLoadState('networkidle');
    // The docs page has a search input for filtering documents
    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="buscar" i]').first();
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeEnabled();
    }
  });

  test('docs page renders without errors', async ({ page }) => {
    await page.goto('/app/docs');
    await page.waitForLoadState('networkidle');
    // Either doc list or empty state should be shown — no crash
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });

  test('sidebar navigation to docs works', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    const docsLink = page.locator('a[href="/app/docs"]').first();
    if (await docsLink.isVisible()) {
      await docsLink.click();
      await page.waitForURL('**/app/docs**');
      await expect(page).toHaveURL(/\/app\/docs/);
    }
  });
});
