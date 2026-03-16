import { test, expect } from '@playwright/test';

test.describe('keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');
  });

  test('"?" opens keyboard help modal', async ({ page }) => {
    await page.keyboard.press('?');
    const modal = page.locator('#keyboard-help-modal');
    await expect(modal).toHaveClass(/visible/, { timeout: 3000 });
  });

  test('"t" toggles theme', async ({ page }) => {
    const html = page.locator('html');
    const themeBefore = await html.getAttribute('data-theme');
    await page.keyboard.press('t');
    const themeAfter = await html.getAttribute('data-theme');
    expect(themeAfter).not.toBe(themeBefore);
  });

  test('Escape closes modal', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.locator('#keyboard-help-modal')).toHaveClass(/visible/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#keyboard-help-modal')).not.toHaveClass(/visible/);
  });

  test('shortcuts do not fire when typing in search', async ({ page }) => {
    await page.locator('#search-input').focus();
    await page.keyboard.type('test');
    await expect(page.locator('#keyboard-help-modal')).not.toHaveClass(/visible/);
  });
});
