import { test, expect } from '@playwright/test';

test.describe('theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');
  });

  test('theme toggle button exists and is visible', async ({ page }) => {
    const toggle = page.locator('#theme-toggle');
    await expect(toggle).toBeVisible();
  });

  test('clicking theme toggle changes data-theme', async ({ page }) => {
    const html = page.locator('html');
    const themeBefore = await html.getAttribute('data-theme');
    await page.click('#theme-toggle');
    const themeAfter = await html.getAttribute('data-theme');
    expect(themeAfter).not.toBe(themeBefore);
  });

  test('theme persists across reload', async ({ page }) => {
    // Get initial theme, toggle, verify it changed
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');
    await page.click('#theme-toggle');
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    const themeAfterReload = await page.locator('html').getAttribute('data-theme');
    expect(themeAfterReload).toBe(newTheme);
  });
});
