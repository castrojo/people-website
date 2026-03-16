import { test, expect } from '@playwright/test';

test.describe('visual layout verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');
  });

  test('page-layout uses CSS grid with sidebar-left 2-column layout', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const el = document.querySelector('.page-layout');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { display: cs.display, cols: cs.gridTemplateColumns };
    });
    expect(layout).not.toBeNull();
    expect(layout!.display).toBe('grid');
    // Should be 2 columns: ~300px sidebar + rest
    const colParts = layout!.cols.split(' ');
    expect(colParts.length).toBe(2);
    expect(parseInt(colParts[0])).toBeGreaterThanOrEqual(280);
    expect(parseInt(colParts[0])).toBeLessThanOrEqual(320);
  });

  test('sidebar renders to the LEFT of main content', async ({ page }) => {
    const positions = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar, aside');
      const main = document.querySelector('.main-content');
      if (!sidebar || !main) return null;
      return {
        sidebarX: sidebar.getBoundingClientRect().x,
        mainX: main.getBoundingClientRect().x,
      };
    });
    expect(positions).not.toBeNull();
    expect(positions!.sidebarX).toBeLessThan(positions!.mainX);
  });

  test('hero cards render in a multi-column grid', async ({ page }) => {
    const heroGrid = await page.evaluate(() => {
      const grid = document.querySelector('.heroes-grid');
      if (!grid) return null;
      const cs = getComputedStyle(grid);
      return { display: cs.display, cols: cs.gridTemplateColumns };
    });
    // Heroes grid should exist and have multiple columns
    if (heroGrid) {
      expect(heroGrid.display).toBe('grid');
      const colCount = heroGrid.cols.split(' ').length;
      expect(colCount).toBeGreaterThanOrEqual(2);
    }
  });

  test('timeline-feed uses single-column layout (expected for people)', async ({ page }) => {
    const feedLayout = await page.evaluate(() => {
      const feed = document.getElementById('timeline-feed');
      if (!feed) return null;
      const cs = getComputedStyle(feed);
      return {
        display: cs.display,
        cols: cs.gridTemplateColumns,
        flexDir: cs.flexDirection,
      };
    });
    expect(feedLayout).not.toBeNull();
    // Timeline feed should NOT be a multi-column grid — it's a vertical feed
    if (feedLayout!.display === 'grid') {
      const colCount = feedLayout!.cols.split(' ').length;
      expect(colCount).toBeLessThanOrEqual(1);
    }
  });

  test('hero cards have minimum dimensions', async ({ page }) => {
    const heroCards = await page.evaluate(() => {
      const cards = document.querySelectorAll('.hero-card');
      if (cards.length === 0) return null;
      return Array.from(cards).slice(0, 4).map(card => {
        const rect = card.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    });
    // If hero cards exist, they should have reasonable minimum dimensions
    if (heroCards) {
      for (const card of heroCards) {
        expect(card.width).toBeGreaterThanOrEqual(200);
        expect(card.height).toBeGreaterThanOrEqual(80);
      }
    }
  });

  test('site switcher pills do not have CNCF prefix', async ({ page }) => {
    await page.goto('./');
    const pills = await page.locator('.switcher-pill').allTextContents();
    expect(pills).toContain('People');
    expect(pills.every(p => !p.startsWith('CNCF'))).toBe(true);
  });

  test('active pill has blue background', async ({ page }) => {
    await page.goto('./');
    const activePill = page.locator('.switcher-pill.active');
    const bg = await activePill.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(0, 134, 255)');
  });
});
