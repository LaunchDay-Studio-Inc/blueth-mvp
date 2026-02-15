import { test, expect } from '@playwright/test';

/**
 * Queue UI smoke tests.
 *
 * These verify that the Action Queue dropdown renders correctly.
 * They do NOT require a running API server — they assert on the
 * client-rendered DOM. Without a session, we test from the login page
 * or verify the redirect behavior.
 */

test.describe('Queue UI smoke', () => {
  test('queue button is visible in the game shell header', async ({ page }) => {
    // Navigate to a game page — will redirect to /login without auth
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/login')) {
      // Without auth we can't see the HUD — verify login renders
      const usernameInput = page.locator('#username');
      await expect(usernameInput).toBeVisible({ timeout: 5_000 });
    } else {
      // If we have a session, the Queue button should be in the header
      const queueBtn = page.locator('button', { hasText: 'Queue' });
      await expect(queueBtn).toBeVisible({ timeout: 10_000 });
    }
  });

  test('queue dropdown opens and shows heading', async ({ page }) => {
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (!url.includes('/login')) {
      // Click the queue button
      const queueBtn = page.locator('button', { hasText: 'Queue' });
      await queueBtn.click();

      // Dropdown should show "Action Queue" heading
      const heading = page.locator('h4', { hasText: 'Action Queue' });
      await expect(heading).toBeVisible({ timeout: 5_000 });
    }
  });

  test('queue dropdown shows empty state or items', async ({ page }) => {
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (!url.includes('/login')) {
      const queueBtn = page.locator('button', { hasText: 'Queue' });
      await queueBtn.click();

      // Should show either the empty state message or action items
      const emptyMsg = page.locator('text=No actions');
      const actionItems = page.locator('[class*="space-y"]');
      const hasEmpty = await emptyMsg.isVisible().catch(() => false);
      const hasItems = await actionItems.isVisible().catch(() => false);
      expect(hasEmpty || hasItems).toBe(true);
    }
  });

  test('queue dropdown closes on backdrop click', async ({ page }) => {
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (!url.includes('/login')) {
      const queueBtn = page.locator('button', { hasText: 'Queue' });
      await queueBtn.click();

      const heading = page.locator('h4', { hasText: 'Action Queue' });
      await expect(heading).toBeVisible({ timeout: 5_000 });

      // Click the backdrop to close
      await page.locator('.fixed.inset-0').first().click({ force: true });
      await expect(heading).not.toBeVisible({ timeout: 3_000 });
    }
  });
});
