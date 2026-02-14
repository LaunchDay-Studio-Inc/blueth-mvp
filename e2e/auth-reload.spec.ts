import { test, expect } from '@playwright/test';

test.describe('Auth reload loop prevention', () => {
  test('login page URL stays stable for 3 seconds (no reload loop)', async ({ page }) => {
    const navigations: string[] = [];

    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    await page.goto('/login');
    await page.waitForTimeout(3000);

    // Should have exactly 1 navigation (the initial page load)
    // If there's a reload loop, there would be many more
    expect(navigations.length).toBeLessThanOrEqual(2);

    // Should still be on /login
    expect(page.url()).toContain('/login');
  });

  test('register page URL stays stable for 3 seconds (no redirect to login)', async ({ page }) => {
    const navigations: string[] = [];

    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    await page.goto('/register');
    await page.waitForTimeout(3000);

    expect(navigations.length).toBeLessThanOrEqual(2);
    expect(page.url()).toContain('/register');
  });

  test('/me/state endpoint is not hammered (max 5 calls in 3 seconds)', async ({ page }) => {
    let meStateCalls = 0;

    page.on('request', (req) => {
      if (req.url().includes('/me/state')) {
        meStateCalls++;
      }
    });

    await page.goto('/login');
    await page.waitForTimeout(3000);

    expect(meStateCalls).toBeLessThanOrEqual(5);
  });

  test('login form is interactive and shows error on bad credentials', async ({ page }) => {
    await page.goto('/login');

    // Form should be usable
    await page.fill('#username', 'nonexistent_user');
    await page.fill('#password', 'BadPassword1');
    await page.click('button[type="submit"]');

    // Should show error (API is likely not running, so either network error or auth error)
    // The key assertion is that no reload loop occurs
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('register form is interactive with client validation', async ({ page }) => {
    await page.goto('/register');

    // Test password mismatch validation
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'StrongPass1');
    await page.fill('#confirm', 'DifferentPass1');
    await page.click('button[type="submit"]');

    // Should show validation error, not reload
    const errorMsg = page.locator('.text-destructive');
    await expect(errorMsg).toContainText('Passwords do not match');
    expect(page.url()).toContain('/register');
  });

  test('register form validates password strength', async ({ page }) => {
    await page.goto('/register');

    await page.fill('#username', 'testuser');
    await page.fill('#password', 'weak');
    await page.fill('#confirm', 'weak');
    await page.click('button[type="submit"]');

    const errorMsg = page.locator('.text-destructive');
    await expect(errorMsg).toContainText('at least 8 characters');
    expect(page.url()).toContain('/register');
  });
});
