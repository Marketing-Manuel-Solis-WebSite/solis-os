import { test, expect } from '@playwright/test';

/**
 * Full Regression Smoke Tests — FASE 11
 *
 * Verifies every major page in the application loads without errors.
 * This is a smoke test, not a full functional test. It ensures no page
 * crashes on mount after the Phase 11 changes (performance, multi-tenant,
 * virtual scroll, image optimization, route prefetching).
 *
 * Prerequisites:
 *   - App running at baseURL (localhost:3000 or staging)
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD env vars set for authenticated tests
 */

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

// ============================================
// PUBLIC PAGES
// ============================================

test.describe('Public pages — regression', () => {
  test('login page renders without errors', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/SOLIS/i);
    await expect(page.locator('body')).toBeVisible();
    // No JS errors on console
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('404 page renders', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');
    await expect(page.locator('body')).toContainText('404');
  });
});

// ============================================
// AUTHENTICATED PAGES — FULL REGRESSION
// ============================================

test.describe('Full app regression (authenticated)', () => {
  test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app**', { timeout: 15_000 });
  });

  // ---- Core pages ----

  test('dashboard loads without error', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Check no uncaught errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('tasks page loads without error', async ({ page }) => {
    await page.goto('/app/tasks');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('docs page loads without error', async ({ page }) => {
    await page.goto('/app/docs');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('goals page loads without error', async ({ page }) => {
    await page.goto('/app/goals');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('chat page loads without error', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('analytics page loads without error', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('automations page loads without error', async ({ page }) => {
    await page.goto('/app/automations');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  // ---- Extended pages ----

  test('planner page loads', async ({ page }) => {
    await page.goto('/app/planner');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('org-chart page loads', async ({ page }) => {
    await page.goto('/app/org-chart');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('spaces page loads', async ({ page }) => {
    await page.goto('/app/spaces');
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

  test('integrations page loads', async ({ page }) => {
    await page.goto('/app/integrations');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('activity page loads', async ({ page }) => {
    await page.goto('/app/activity');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  // ---- Sidebar navigation ----

  test('sidebar renders and navigation works', async ({ page }) => {
    // Should see sidebar nav buttons
    await expect(page.locator('aside').first()).toBeVisible();

    // Navigate to tasks via sidebar button
    const tasksButton = page.locator('button', { hasText: /tasks|tareas/i }).first();
    if (await tasksButton.isVisible()) {
      await tasksButton.click();
      await page.waitForURL('**/app/tasks**', { timeout: 10_000 });
      await expect(page).toHaveURL(/\/app\/tasks/);
    }
  });

  // ---- Console error check across pages ----

  test('no console errors on main pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const pages = ['/app', '/app/tasks', '/app/docs', '/app/goals', '/app/chat', '/app/analytics', '/app/automations'];
    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState('networkidle');
    }

    // Filter out known benign errors (e.g. Firebase permission warnings in test env)
    const critical = errors.filter(e => !e.includes('permission') && !e.includes('Missing or insufficient'));
    expect(critical).toHaveLength(0);
  });
});
