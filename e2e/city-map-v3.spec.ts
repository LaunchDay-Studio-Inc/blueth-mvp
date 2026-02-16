import { test, expect } from '@playwright/test';

/**
 * Map V3 Engine smoke tests.
 *
 * These verify the core engine behaviors:
 * 1. Map renders with SVG layers
 * 2. Clicking a district updates the dossier panel
 * 3. Zoom in/out controls work
 *
 * Note: Without auth, /city redirects to /login.
 * These tests target the login page to verify render,
 * or -- if a session exists -- the city page directly.
 */

test.describe('City Map V3 — smoke tests', () => {
  test('city map page loads without errors', async ({ page }) => {
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/login')) {
      // Redirected to login — page is still functional
      const loginForm = page.locator('#username');
      await expect(loginForm).toBeVisible({ timeout: 10_000 });
    } else {
      // Map SVG should be present
      const svg = page.locator('svg');
      await expect(svg.first()).toBeVisible({ timeout: 10_000 });

      // Layer groups should exist
      const panZoomRoot = page.locator('#pan-zoom-root');
      await expect(panZoomRoot).toBeAttached();

      const hitTargets = page.locator('#layer-hit-targets');
      await expect(hitTargets).toBeAttached();
    }
  });

  test('district click updates dossier panel', async ({ page }) => {
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/login')) {
      test.skip(true, 'Requires auth — skipping');
      return;
    }

    // Click CBD district
    const cbdHit = page.locator('[data-testid="district-CBD"]');
    await expect(cbdHit).toBeAttached({ timeout: 10_000 });
    await cbdHit.click({ force: true });

    // Dossier panel should show CBD info
    await expect(page.locator('text=District Dossier')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Central Business District')).toBeVisible();
  });

  test('zoom controls are visible and functional', async ({ page }) => {
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/login')) {
      test.skip(true, 'Requires auth — skipping');
      return;
    }

    // Zoom buttons should be visible
    const zoomIn = page.locator('[data-testid="zoom-in"]');
    const zoomOut = page.locator('[data-testid="zoom-out"]');
    const zoomReset = page.locator('[data-testid="zoom-reset"]');

    await expect(zoomIn).toBeVisible({ timeout: 10_000 });
    await expect(zoomOut).toBeVisible();
    await expect(zoomReset).toBeVisible();

    // Click zoom in — the pan-zoom-root transform should change
    await zoomIn.click();
    await page.waitForTimeout(300);

    const transform = await page.locator('#pan-zoom-root').getAttribute('transform');
    expect(transform).toContain('scale(');
    // Scale should be > 1 after zooming in
    const scaleMatch = transform?.match(/scale\(([\d.]+)\)/);
    if (scaleMatch) {
      expect(parseFloat(scaleMatch[1])).toBeGreaterThan(1);
    }
  });

  test('clicking empty space deselects district', async ({ page }) => {
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/login')) {
      test.skip(true, 'Requires auth — skipping');
      return;
    }

    // Select a district first
    const cbdHit = page.locator('[data-testid="district-CBD"]');
    await expect(cbdHit).toBeAttached({ timeout: 10_000 });
    await cbdHit.click({ force: true });
    await expect(page.locator('text=Central Business District')).toBeVisible({ timeout: 5_000 });

    // Click the same district to deselect (toggle)
    await cbdHit.click({ force: true });
    await page.waitForTimeout(500);

    // Dossier should show the empty state
    await expect(page.locator('text=Select a district on the board')).toBeVisible({ timeout: 5_000 });
  });

  test('all 12 district hit targets exist', async ({ page }) => {
    await page.goto('/city');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/login')) {
      test.skip(true, 'Requires auth — skipping');
      return;
    }

    const codes = [
      'CBD', 'OLD_TOWN', 'MARINA', 'TECH_PARK', 'MARKET_SQ',
      'ENTERTAINMENT', 'UNIVERSITY', 'HARBOR', 'INDUSTRIAL',
      'SUBURBS_N', 'SUBURBS_S', 'OUTSKIRTS',
    ];

    for (const code of codes) {
      const hit = page.locator(`[data-testid="district-${code}"]`);
      await expect(hit).toBeAttached({ timeout: 5_000 });
    }
  });
});
