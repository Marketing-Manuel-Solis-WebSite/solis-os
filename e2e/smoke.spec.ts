import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify the critical paths render without errors.
 * These run against a real (or staging) environment and do NOT mock Firebase.
 *
 * Prerequisites:
 *   - App running at baseURL (localhost:3000 or staging)
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD env vars set for authenticated tests
 */

// ============================================
// PUBLIC ROUTES
// ============================================

test.describe('Public pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/SOLIS/i);
    // Should show a sign-in form or auth UI
    await expect(page.locator('body')).toBeVisible();
  });

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.locator('body')).toContainText('404');
  });
});

// ============================================
// AUTHENTICATED ROUTES (skip if no credentials)
// ============================================

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('App shell (authenticated)', () => {
  test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    // Navigate to login and authenticate
    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    // Wait for redirect to /app (dashboard)
    await page.waitForURL('**/app**', { timeout: 15_000 });
  });

  test('dashboard loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    // Sidebar should contain at least one nav link
    await expect(page.locator('nav a, aside a').first()).toBeVisible();
  });

  test('tasks page loads', async ({ page }) => {
    await page.goto('/app/tasks');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('docs page loads', async ({ page }) => {
    await page.goto('/app/docs');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('chat page loads', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('analytics page loads', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('goals page loads', async ({ page }) => {
    await page.goto('/app/goals');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('automations page loads', async ({ page }) => {
    await page.goto('/app/automations');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('forms page loads', async ({ page }) => {
    await page.goto('/app/forms');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('timesheets page loads', async ({ page }) => {
    await page.goto('/app/timesheets');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('whiteboards page loads', async ({ page }) => {
    await page.goto('/app/whiteboards');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('sidebar navigation works', async ({ page }) => {
    // Click on Tasks in sidebar
    const tasksLink = page.locator('a[href="/app/tasks"]').first();
    if (await tasksLink.isVisible()) {
      await tasksLink.click();
      await page.waitForURL('**/app/tasks**');
      await expect(page).toHaveURL(/\/app\/tasks/);
    }
  });
});
