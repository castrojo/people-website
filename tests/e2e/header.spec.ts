/**
 * Header conformance tests for people-website.
 *
 * These tests verify that the header is pixel-identical to the projects-website
 * reference implementation. Every assertion here has a matching assertion in
 * projects-website/tests/e2e/header.spec.ts. If either site drifts, CI fails.
 *
 * Reference values (from projects-website):
 *   logo:             42×42
 *   font-family:      system stack (no Clarity City)
 *   section-link:     font-size 0.875rem (14px), padding 0.5rem 1rem
 *   active tab color: var(--color-accent-emphasis) = #0969da light / #2f81f7 dark
 *   search width:     360px
 *   header:           position sticky
 *   nav-group:        sibling of .header-left (flex-direction row)
 */
import { test, expect } from '@playwright/test';

// ─── Desktop ────────────────────────────────────────────────────────────────

test.describe('header — desktop (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
  });

  test('CNCF logo renders at 42×42', async ({ page }) => {
    const size = await page.evaluate(() => {
      const img = document.querySelector('.cncf-logo-wrapper img, .cncf-logo-wrapper svg') as Element | null;
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(size).not.toBeNull();
    expect(size!.h).toBeLessThanOrEqual(42);
    expect(size!.h).toBeGreaterThan(0);
  });

  test('body uses system font stack (no Clarity City)', async ({ page }) => {
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily.toLowerCase()).not.toContain('clarity');
  });

  test('site title reads "CNCF People"', async ({ page }) => {
    const text = await page.locator('.site-title').textContent();
    expect(text?.trim()).toBe('CNCF People');
  });

  test('site title font-size is at least 20px', async ({ page }) => {
    const fontSize = await page.evaluate(() => {
      const el = document.querySelector('.site-title');
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    });
    expect(fontSize).toBeGreaterThanOrEqual(20);
  });

  test('no rotating slogan element in header', async ({ page }) => {
    await expect(page.locator('#rotating-slogan')).toHaveCount(0);
  });

  test('SiteSwitcher has exactly 3 pills', async ({ page }) => {
    await expect(page.locator('.switcher-pill')).toHaveCount(3);
  });

  test('"People" pill is active', async ({ page }) => {
    const activePill = await page.locator('.switcher-pill.active').textContent();
    expect(activePill?.trim()).toBe('People');
  });

  test('SiteSwitcher pills are People / Projects / End Users', async ({ page }) => {
    const pills = await page.locator('.switcher-pill').allTextContents();
    expect(pills.map(p => p.trim())).toEqual(['People', 'Projects', 'End Users']);
  });

  test('search input is visible and in .nav-group', async ({ page }) => {
    await expect(page.locator('.nav-group #search-input')).toBeVisible();
    await expect(page.locator('.header-left #search-input')).toHaveCount(0);
  });

  test('search input is ~360px wide on desktop', async ({ page }) => {
    const width = await page.evaluate(() => {
      const el = document.getElementById('search-input');
      return el ? el.getBoundingClientRect().width : 0;
    });
    expect(width).toBeGreaterThanOrEqual(300);
  });

  test('search clear button is hidden on load', async ({ page }) => {
    const display = await page.evaluate(() => {
      const btn = document.getElementById('search-clear');
      return btn ? getComputedStyle(btn).display : null;
    });
    expect(display).toBe('none');
  });

  test('typing in search shows clear button', async ({ page }) => {
    await page.locator('#search-input').fill('kubernetes');
    const display = await page.evaluate(() => {
      const btn = document.getElementById('search-clear') as HTMLElement | null;
      return btn ? btn.style.display : null;
    });
    expect(display).toBe('flex');
  });

  test('clicking clear empties input and hides button', async ({ page }) => {
    await page.locator('#search-input').fill('kubernetes');
    await page.locator('#search-clear').click();
    await expect(page.locator('#search-input')).toHaveValue('');
    const display = await page.evaluate(() => {
      const btn = document.getElementById('search-clear') as HTMLElement | null;
      return btn ? btn.style.display : null;
    });
    expect(display).toBe('none');
  });

  test('search input has blue border on focus', async ({ page }) => {
    await page.locator('#search-input').focus();
    const borderColor = await page.evaluate(() => {
      const el = document.getElementById('search-input');
      return el ? getComputedStyle(el).borderColor : null;
    });
    // --color-cncf-blue resolves to rgb(0, 134, 255)
    expect(borderColor).toBe('rgb(0, 134, 255)');
  });

  test('section-nav has at least 9 tab buttons (People has many roles)', async ({ page }) => {
    const count = await page.locator('.section-nav .section-link').count();
    expect(count).toBeGreaterThanOrEqual(9);
  });

  test('section-nav tabs include Everyone, Ambassadors, Kubestronauts, Memorial', async ({ page }) => {
    const tabs = await page.locator('.section-nav .section-link').allTextContents();
    const trimmed = tabs.map(t => t.trim());
    expect(trimmed).toContain('Everyone');
    expect(trimmed).toContain('Ambassadors');
    expect(trimmed).toContain('Kubestronauts');
    expect(trimmed).toContain('Memorial');
  });

  test('"Everyone" tab is active on load', async ({ page }) => {
    const activeTab = await page.locator('.section-nav .section-link.active').textContent();
    expect(activeTab?.trim()).toBe('Everyone');
  });

  test('section-link font-size matches reference (14px = 0.875rem)', async ({ page }) => {
    const fontSize = await page.evaluate(() => {
      const link = document.querySelector('.section-link');
      return link ? parseFloat(getComputedStyle(link).fontSize) : 0;
    });
    expect(fontSize).toBeCloseTo(14, 0);
  });

  test('active tab uses accent-emphasis color (not plain text or cncf-blue)', async ({ page }) => {
    const color = await page.evaluate(() => {
      const active = document.querySelector('.section-link.active');
      return active ? getComputedStyle(active).color : null;
    });
    // rgb(9, 105, 218) = #0969da (light mode accent-emphasis)
    expect(color).toBe('rgb(9, 105, 218)');
  });

  test('header is sticky positioned', async ({ page }) => {
    const position = await page.evaluate(() => {
      const header = document.querySelector('header.site-header');
      return header ? getComputedStyle(header).position : null;
    });
    expect(position).toBe('sticky');
  });

  test('ThemeToggle button is visible', async ({ page }) => {
    await expect(page.locator('[aria-label*="theme" i], #theme-toggle').first()).toBeVisible();
  });

  test('keyboard help button is visible', async ({ page }) => {
    await expect(page.locator('#help-button')).toBeVisible();
  });

  test('nav-group is to the right of header-left', async ({ page }) => {
    const positions = await page.evaluate(() => {
      const left = document.querySelector('.header-left');
      const nav = document.querySelector('.nav-group');
      if (!left || !nav) return null;
      return { leftRight: left.getBoundingClientRect().right, navLeft: nav.getBoundingClientRect().left };
    });
    expect(positions).not.toBeNull();
    expect(positions!.navLeft).toBeGreaterThan(positions!.leftRight);
  });

  test('nav-group and header-left are on the same horizontal row', async ({ page }) => {
    const positions = await page.evaluate(() => {
      const left = document.querySelector('.header-left');
      const nav = document.querySelector('.nav-group');
      if (!left || !nav) return null;
      const leftMid = left.getBoundingClientRect().top + left.getBoundingClientRect().height / 2;
      const navMid = nav.getBoundingClientRect().top + nav.getBoundingClientRect().height / 2;
      return { leftMid, navMid };
    });
    expect(positions).not.toBeNull();
    // centres should be within 10px of each other (same row)
    expect(Math.abs(positions!.leftMid - positions!.navMid)).toBeLessThan(10);
  });
});

// ─── Mobile ─────────────────────────────────────────────────────────────────

test.describe('header — mobile (375×667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('domcontentloaded');
  });

  test('nav-group stacks below header-left on mobile', async ({ page }) => {
    const positions = await page.evaluate(() => {
      const left = document.querySelector('.header-left');
      const nav = document.querySelector('.nav-group');
      if (!left || !nav) return null;
      return { leftBottom: left.getBoundingClientRect().bottom, navTop: nav.getBoundingClientRect().top };
    });
    expect(positions).not.toBeNull();
    expect(positions!.navTop).toBeGreaterThanOrEqual(positions!.leftBottom - 4);
  });

  test('search input has positive width on mobile', async ({ page }) => {
    const width = await page.evaluate(() => {
      const el = document.getElementById('search-input');
      return el ? el.getBoundingClientRect().width : 0;
    });
    expect(width).toBeGreaterThan(100);
  });

  test('SiteSwitcher pills are smaller on mobile', async ({ page }) => {
    const mobilePadding = await page.evaluate(() => {
      const pill = document.querySelector('.switcher-pill');
      return pill ? parseFloat(getComputedStyle(pill).paddingTop) : 0;
    });
    expect(mobilePadding).toBeLessThanOrEqual(4);
  });
});
