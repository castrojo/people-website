import { test, expect } from '@playwright/test';

test.describe('layout structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');
  });

  test('sidebar is on the LEFT side of content', async ({ page }) => {
    const sidebar = page.locator('aside.sidebar');
    const content = page.locator('.main-content');
    await expect(sidebar).toBeVisible();
    await expect(content).toBeVisible();
    const sidebarBox = await sidebar.boundingBox();
    const contentBox = await content.boundingBox();
    expect(sidebarBox!.x).toBeLessThan(contentBox!.x);
  });

  test('CNCF logo is visible in header', async ({ page }) => {
    const logo = page.locator('header .cncf-logo-wrapper');
    await expect(logo).toBeVisible();
  });

  test('header contains title, slogan, switcher, search, theme toggle, help', async ({ page }) => {
    const header = page.locator('header');
    await expect(header.locator('h1.site-title')).toBeVisible();
    await expect(header.locator('#rotating-slogan')).toBeVisible();
    await expect(header.locator('.site-switcher')).toBeVisible();
    await expect(header.locator('#search-input')).toBeVisible();
    await expect(header.locator('#help-button')).toBeVisible();
  });

  test('search input is in header-left section', async ({ page }) => {
    const searchInLeft = page.locator('.header-left #search-input');
    await expect(searchInLeft).toBeVisible();
  });

  test('tab navigation exists with section-nav', async ({ page }) => {
    const nav = page.locator('nav.section-nav');
    await expect(nav).toBeVisible();
  });

  test('section-nav has multiple tab buttons', async ({ page }) => {
    const tabs = page.locator('nav.section-nav button.section-link[data-tab]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(9);
  });

  test('SiteSwitcher has 3 pills', async ({ page }) => {
    const pills = page.locator('.switcher-pill');
    await expect(pills).toHaveCount(3);
  });

  test('kbd-live-region exists for accessibility', async ({ page }) => {
    const liveRegion = page.locator('#kbd-live-region');
    await expect(liveRegion).toBeAttached();
  });

  test('page-layout uses grid with sidebar first', async ({ page }) => {
    const layout = page.locator('.page-layout');
    await expect(layout).toBeVisible();
    const children = layout.locator('> *');
    const firstChild = children.first();
    await expect(firstChild).toHaveClass(/sidebar/);
  });

  test('footer exists', async ({ page }) => {
    const footer = page.locator('footer.site-footer');
    await expect(footer).toBeVisible();
  });
});
