import { test, expect } from '@playwright/test';

test.describe('search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.person-card', { timeout: 10000 });
  });

  test('search input exists and is focusable', async ({ page }) => {
    const input = page.locator('#search-input');
    await expect(input).toBeVisible();
    await input.focus();
    await expect(input).toBeFocused();
  });

  test('"/" focuses search', async ({ page }) => {
    await page.keyboard.press('/');
    await expect(page.locator('#search-input')).toBeFocused();
  });
});
