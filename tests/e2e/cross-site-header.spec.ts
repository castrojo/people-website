/**
 * Cross-site header geometry consistency test.
 *
 * Verifies that when a user presses [ or ] to switch between the three cncf.dev
 * sites, the header elements (logo, title block, SiteSwitcher, search input,
 * help button, section-nav row) appear at identical pixel positions.
 *
 * REQUIREMENTS: All three local servers must be running before this test:
 *   cd ~/src/projects-website && just serve   # port 4322
 *   cd ~/src/people-website   && just serve   # port 4323
 *   cd ~/src/endusers-website && just serve   # port 4324
 *
 * Run: npx playwright test tests/e2e/cross-site-header.spec.ts
 *
 * DO NOT use toBeVisible() for geometry checks — it proves nothing about position.
 * Always use page.evaluate() + getBoundingClientRect() and compare numerically.
 */

import { test, expect, type Page } from '@playwright/test';

const SITES = [
  { name: 'projects', url: 'http://localhost:4322/projects-website/' },
  { name: 'people',   url: 'http://localhost:4323/people-website/' },
  { name: 'endusers', url: 'http://localhost:4324/endusers-website/' },
];

/** Maximum pixel deviation allowed between sites for a "stable" element. */
const TOLERANCE_PX = 3;

interface HeaderGeometry {
  // Full header
  headerHeight: number;
  headerBottom: number;
  // Logo
  logoTop: number;
  logoHeight: number;
  // Title block
  titleTop: number;
  titleHeight: number;
  // header-left block (logo+title together)
  headerLeftWidth: number;
  // SiteSwitcher pill group
  switcherTop: number;
  switcherLeft: number;
  switcherHeight: number;
  // Search input
  searchTop: number;
  searchLeft: number;
  searchWidth: number;
  searchHeight: number;
  // Help button
  helpTop: number;
  helpHeight: number;
  // Section-nav row (tab bar height is the critical "jump" indicator)
  sectionNavTop: number;
  sectionNavHeight: number;
}

async function measureHeader(page: Page): Promise<HeaderGeometry> {
  return page.evaluate(() => {
    const rect = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return el.getBoundingClientRect();
    };

    const header     = rect('.site-header');
    const logo       = rect('.cncf-logo-wrapper');
    const title      = rect('.title-block');
    const headerLeft = rect('.header-left');
    const switcher   = rect('.site-switcher');
    const search     = rect('#search-input');
    const help       = rect('#help-button');
    const nav        = rect('.section-nav');

    if (!header || !logo || !title || !headerLeft || !switcher || !search || !help || !nav) {
      throw new Error(`Missing element in ${document.title}: header=${!!header} logo=${!!logo} title=${!!title} left=${!!headerLeft} switcher=${!!switcher} search=${!!search} help=${!!help} nav=${!!nav}`);
    }

    return {
      headerHeight:     header.height,
      headerBottom:     header.bottom,
      logoTop:          logo.top,
      logoHeight:       logo.height,
      titleTop:         title.top,
      titleHeight:      title.height,
      headerLeftWidth:  headerLeft.width,
      switcherTop:      switcher.top,
      switcherLeft:     switcher.left,
      switcherHeight:   switcher.height,
      searchTop:        search.top,
      searchLeft:       search.left,
      searchWidth:      search.width,
      searchHeight:     search.height,
      helpTop:          help.top,
      helpHeight:       help.height,
      sectionNavTop:    nav.top,
      sectionNavHeight: nav.height,
    };
  });
}

function assertWithinTolerance(
  label: string,
  ref: number,
  actual: number,
  tolerance = TOLERANCE_PX,
) {
  expect(
    Math.abs(ref - actual),
    `"${label}" should be within ${tolerance}px: reference=${ref.toFixed(1)} actual=${actual.toFixed(1)} diff=${Math.abs(ref - actual).toFixed(1)}px`,
  ).toBeLessThanOrEqual(tolerance);
}

test.describe('cross-site header geometry — 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let geometries: Record<string, HeaderGeometry> = {};

  // Measure all three sites before comparing
  for (const site of SITES) {
    test(`measure header on ${site.name}`, async ({ page }) => {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      geometries[site.name] = await measureHeader(page);
    });
  }

  test('header HEIGHT is identical across all three sites', async ({ page }) => {
    // Measure fresh in one test to avoid cross-test state issues
    const measurements: HeaderGeometry[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      measurements.push(await measureHeader(page));
    }
    const [proj, people, endusers] = measurements;

    assertWithinTolerance('header height: people vs projects',   proj.headerHeight,    people.headerHeight);
    assertWithinTolerance('header height: endusers vs projects', proj.headerHeight, endusers.headerHeight);
  });

  test('section-nav HEIGHT is identical (no tab-wrap jump)', async ({ page }) => {
    const measurements: HeaderGeometry[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      measurements.push(await measureHeader(page));
    }
    const [proj, people, endusers] = measurements;

    assertWithinTolerance('section-nav height: people vs projects',   proj.sectionNavHeight,    people.sectionNavHeight);
    assertWithinTolerance('section-nav height: endusers vs projects', proj.sectionNavHeight, endusers.sectionNavHeight);
  });

  test('search input position and size is identical', async ({ page }) => {
    const measurements: HeaderGeometry[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      measurements.push(await measureHeader(page));
    }
    const [proj, people, endusers] = measurements;

    assertWithinTolerance('search top: people vs projects',    proj.searchTop,   people.searchTop);
    assertWithinTolerance('search top: endusers vs projects',  proj.searchTop,   endusers.searchTop);
    assertWithinTolerance('search left: people vs projects',   proj.searchLeft,  people.searchLeft);
    assertWithinTolerance('search left: endusers vs projects', proj.searchLeft,  endusers.searchLeft);
    assertWithinTolerance('search width: people vs projects',  proj.searchWidth, people.searchWidth,  0);
    assertWithinTolerance('search width: endusers vs projects',proj.searchWidth, endusers.searchWidth, 0);
  });

  test('SiteSwitcher position is identical', async ({ page }) => {
    const measurements: HeaderGeometry[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      measurements.push(await measureHeader(page));
    }
    const [proj, people, endusers] = measurements;

    assertWithinTolerance('switcher top: people vs projects',    proj.switcherTop,  people.switcherTop);
    assertWithinTolerance('switcher top: endusers vs projects',  proj.switcherTop,  endusers.switcherTop);
    assertWithinTolerance('switcher left: people vs projects',   proj.switcherLeft, people.switcherLeft);
    assertWithinTolerance('switcher left: endusers vs projects', proj.switcherLeft, endusers.switcherLeft);
  });

  test('logo and title are vertically centered at same top position', async ({ page }) => {
    const measurements: HeaderGeometry[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      measurements.push(await measureHeader(page));
    }
    const [proj, people, endusers] = measurements;

    assertWithinTolerance('logo top: people vs projects',   proj.logoTop,  people.logoTop);
    assertWithinTolerance('logo top: endusers vs projects', proj.logoTop,  endusers.logoTop);
    assertWithinTolerance('title top: people vs projects',  proj.titleTop, people.titleTop);
    assertWithinTolerance('title top: endusers vs projects',proj.titleTop, endusers.titleTop);
  });

  test('header-left min-width ensures nav-group starts at same x-position', async ({ page }) => {
    const measurements: HeaderGeometry[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      measurements.push(await measureHeader(page));
    }
    const [proj, people, endusers] = measurements;

    // SiteSwitcher left == nav-group left + padding, so switcher.left is the proxy
    assertWithinTolerance('nav start (switcher.left): people vs projects',   proj.switcherLeft, people.switcherLeft);
    assertWithinTolerance('nav start (switcher.left): endusers vs projects', proj.switcherLeft, endusers.switcherLeft);
  });
});

test.describe('cross-site header geometry — 1440×900 (wider viewport)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('section-nav does not wrap at 1440px on any site', async ({ page }) => {
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');

      const navWrapped = await page.evaluate(() => {
        const nav = document.querySelector('.section-nav');
        if (!nav) return false;
        const buttons = Array.from(nav.querySelectorAll('.section-link'));
        if (buttons.length < 2) return false;
        const firstTop = buttons[0].getBoundingClientRect().top;
        return buttons.some(b => Math.abs(b.getBoundingClientRect().top - firstTop) > 4);
      });

      expect(navWrapped, `section-nav should not wrap on ${site.name} at 1440px`).toBe(false);
    }
  });
});
