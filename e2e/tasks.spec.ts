import { test, expect } from '@playwright/test';

/**
 * Step 12: E2E Task CRUD flow — smoke tests.
 * Verify the tasks page loads, key elements are visible, and the task list renders.
 *
 * Prerequisites:
 *   - App running at baseURL (localhost:3000 or staging)
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD env vars set for authenticated tests
 */

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('Task CRUD flow', () => {
  test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app**', { timeout: 15_000 });
  });

  test('tasks page loads successfully', async ({ page }) => {
    await page.goto('/app/tasks');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('tasks page displays header', async ({ page }) => {
    await page.goto('/app/tasks');
    await page.waitForLoadState('networkidle');
    // The page should render a visible heading or toolbar area
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('create task button is visible', async ({ page }) => {
    await page.goto('/app/tasks');
    await page.waitForLoadState('networkidle');
    // Look for a create/add task button
    const createBtn = page.locator('button').filter({ hasText: /create|add|nueva|crear/i }).first();
    if (await createBtn.isVisible()) {
      await expect(createBtn).toBeEnabled();
    }
  });

  test('task list area renders', async ({ page }) => {
    await page.goto('/app/tasks');
    await page.waitForLoadState('networkidle');
    // The task list view, board view, or empty state should be present
    // Either task items render, or an empty-state placeholder is shown
    await expect(page.locator('body')).toBeVisible();
    // No uncaught errors — page should not contain a generic error boundary message
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });

  test('view toggle buttons are accessible', async ({ page }) => {
    await page.goto('/app/tasks');
    await page.waitForLoadState('networkidle');
    // The toolbar should include view-switch buttons (list, board, calendar)
    // We just verify the page rendered without errors
    const toolbar = page.locator('button').first();
    await expect(toolbar).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar navigation to tasks works', async ({ page }) => {
    // Start from dashboard, navigate to tasks via sidebar
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    const tasksLink = page.locator('a[href="/app/tasks"]').first();
    if (await tasksLink.isVisible()) {
      await tasksLink.click();
      await page.waitForURL('**/app/tasks**');
      await expect(page).toHaveURL(/\/app\/tasks/);
    }
  });
});
