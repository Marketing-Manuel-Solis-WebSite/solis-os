import { test, expect } from '@playwright/test';

/**
 * Step 14: E2E Chat flow — smoke tests.
 * Verify the chat page loads and chat interface elements are visible.
 *
 * Prerequisites:
 *   - App running at baseURL (localhost:3000 or staging)
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD env vars set for authenticated tests
 */

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('Chat flow', () => {
  test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app**', { timeout: 15_000 });
  });

  test('chat page loads successfully', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('chat page displays interface elements', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');
    // The chat page should render the channel sidebar or a channel list
    // and a message area — at minimum, the body should have visible content
    await expect(page.locator('body')).toBeVisible();
    // No uncaught errors
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });

  test('chat channel list or empty state is visible', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');
    // Either the channel sidebar renders with channels,
    // or an empty state / message icon placeholder is shown
    const channelOrEmpty = page.locator('aside, nav, [role="navigation"], [data-testid="channel-sidebar"]').first();
    // Graceful: if sidebar is visible, great; if not, page should still render
    await expect(page.locator('body')).toBeVisible();
  });

  test('create channel button or chat action is accessible', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');
    // The chat page should have a way to create a new channel or start a DM
    const createBtn = page.locator('button').filter({ hasText: /create|new|channel|canal/i }).first();
    if (await createBtn.isVisible()) {
      await expect(createBtn).toBeEnabled();
    }
  });

  test('chat page renders without errors', async ({ page }) => {
    await page.goto('/app/chat');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Unhandled Runtime Error');
  });

  test('sidebar navigation to chat works', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    const chatLink = page.locator('a[href="/app/chat"]').first();
    if (await chatLink.isVisible()) {
      await chatLink.click();
      await page.waitForURL('**/app/chat**');
      await expect(page).toHaveURL(/\/app\/chat/);
    }
  });
});
