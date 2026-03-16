import { test, expect } from '@playwright/test';

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with person cards visible', async ({ page }) => {
    const cards = page.locator('.person-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('tab buttons exist and are clickable', async ({ page }) => {
    const tabs = page.locator('[data-tab]');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(3);
    await tabs.first().click();
  });

  test('hero section shows spotlight cards', async ({ page }) => {
    const heroes = page.locator('.hero-card');
    await expect(heroes.first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking a tab changes active state', async ({ page }) => {
    const ambassadorTab = page.locator('[data-tab="ambassadors"]');
    await ambassadorTab.click();
    await expect(ambassadorTab).toHaveClass(/active/);
  });

  test('everyone tab is default active', async ({ page }) => {
    const everyoneTab = page.locator('[data-tab="everyone"]');
    await expect(everyoneTab).toHaveClass(/active/);
  });
});
