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

test.describe('cross-site header computed styles', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  interface HeaderStyles {
    // Typography
    siteTitleFontSize:   string;
    siteTitleFontWeight: string;
    siteTitleFontFamily: string;
    // Search input
    searchFontSize:      string;
    searchBorderRadius:  string;
    searchWidth:         string;
    // Section-nav tabs
    sectionLinkFontSize:   string;
    sectionLinkFontWeight: string; // active tab
    // SiteSwitcher
    switcherBorderRadius: string;
    activePillBackground: string;
    // Header background
    headerBackground: string;
    // Section-nav min-height (no wrap check)
    sectionNavDisplay: string;
    sectionNavFlexWrap: string;
  }

  async function measureStyles(page: Page): Promise<HeaderStyles> {
    return page.evaluate(() => {
      const cs = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Missing element: ${sel}`);
        return getComputedStyle(el);
      };

      const titleStyle   = cs('.site-title');
      const searchStyle  = cs('#search-input');
      const navLinkStyle = cs('.section-link');
      const activeLinkStyle = cs('.section-link.active');
      const switcherStyle   = cs('.site-switcher');
      const activePillStyle = cs('.switcher-pill.active');
      const headerStyle     = cs('.site-header');
      const navStyle        = cs('.section-nav');

      return {
        siteTitleFontSize:     titleStyle.fontSize,
        siteTitleFontWeight:   titleStyle.fontWeight,
        siteTitleFontFamily:   titleStyle.fontFamily,
        searchFontSize:        searchStyle.fontSize,
        searchBorderRadius:    searchStyle.borderRadius,
        searchWidth:           searchStyle.width,
        sectionLinkFontSize:   navLinkStyle.fontSize,
        sectionLinkFontWeight: activeLinkStyle.fontWeight,
        switcherBorderRadius:  switcherStyle.borderRadius,
        activePillBackground:  activePillStyle.backgroundColor,
        headerBackground:      headerStyle.backgroundColor,
        sectionNavDisplay:     navStyle.display,
        sectionNavFlexWrap:    navStyle.flexWrap,
      };
    });
  }

  test('font-family is identical across all three sites', async ({ page }) => {
    const styles: HeaderStyles[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      styles.push(await measureStyles(page));
    }
    const [proj, people, endusers] = styles;

    expect(people.siteTitleFontFamily,
      `people font-family should match projects: ${proj.siteTitleFontFamily}`
    ).toBe(proj.siteTitleFontFamily);
    expect(endusers.siteTitleFontFamily,
      `endusers font-family should match projects: ${proj.siteTitleFontFamily}`
    ).toBe(proj.siteTitleFontFamily);
  });

  test('site-title font-size and font-weight are identical', async ({ page }) => {
    const styles: HeaderStyles[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      styles.push(await measureStyles(page));
    }
    const [proj, people, endusers] = styles;

    expect(people.siteTitleFontSize).toBe(proj.siteTitleFontSize);
    expect(endusers.siteTitleFontSize).toBe(proj.siteTitleFontSize);
    expect(people.siteTitleFontWeight).toBe(proj.siteTitleFontWeight);
    expect(endusers.siteTitleFontWeight).toBe(proj.siteTitleFontWeight);
  });

  test('search input font-size, border-radius, and width are identical', async ({ page }) => {
    const styles: HeaderStyles[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      styles.push(await measureStyles(page));
    }
    const [proj, people, endusers] = styles;

    expect(people.searchFontSize).toBe(proj.searchFontSize);
    expect(endusers.searchFontSize).toBe(proj.searchFontSize);
    expect(people.searchBorderRadius).toBe(proj.searchBorderRadius);
    expect(endusers.searchBorderRadius).toBe(proj.searchBorderRadius);
    expect(people.searchWidth).toBe(proj.searchWidth);
    expect(endusers.searchWidth).toBe(proj.searchWidth);
  });

  test('section-link tab font-size is identical and active tab font-weight matches', async ({ page }) => {
    const styles: HeaderStyles[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      styles.push(await measureStyles(page));
    }
    const [proj, people, endusers] = styles;

    expect(people.sectionLinkFontSize).toBe(proj.sectionLinkFontSize);
    expect(endusers.sectionLinkFontSize).toBe(proj.sectionLinkFontSize);
    expect(people.sectionLinkFontWeight).toBe(proj.sectionLinkFontWeight);
    expect(endusers.sectionLinkFontWeight).toBe(proj.sectionLinkFontWeight);
  });

  test('active SiteSwitcher pill background is CNCF blue on all sites', async ({ page }) => {
    const styles: HeaderStyles[] = [];
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      styles.push(await measureStyles(page));
    }
    const [proj, people, endusers] = styles;

    // All three active pills should be rgb(0, 134, 255) = #0086FF
    expect(proj.activePillBackground).toBe('rgb(0, 134, 255)');
    expect(people.activePillBackground).toBe('rgb(0, 134, 255)');
    expect(endusers.activePillBackground).toBe('rgb(0, 134, 255)');
  });

  test('section-nav does not flex-wrap on any site', async ({ page }) => {
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      const { display, flexWrap } = await page.evaluate(() => {
        const nav = document.querySelector('.section-nav');
        if (!nav) throw new Error('Missing .section-nav');
        const cs = getComputedStyle(nav);
        return { display: cs.display, flexWrap: cs.flexWrap };
      });
      expect(display, `${site.name}: section-nav display`).toBe('flex');
      expect(flexWrap, `${site.name}: section-nav must not wrap`).toBe('nowrap');
    }
  });

  test('section-nav does not visually wrap at 375px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      const wrapped = await page.evaluate(() => {
        const nav = document.querySelector('.section-nav');
        if (!nav) return false;
        const buttons = Array.from(nav.querySelectorAll('.section-link'));
        if (buttons.length < 2) return false;
        const firstTop = buttons[0].getBoundingClientRect().top;
        return buttons.some(b => Math.abs(b.getBoundingClientRect().top - firstTop) > 4);
      });
      expect(wrapped, `${site.name}: section-nav should not visually wrap at 375px`).toBe(false);
    }
  });

  test('header-left is exactly 240px wide on all sites', async ({ page }) => {
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      const width = await page.evaluate(() => {
        const el = document.querySelector('.header-left');
        if (!el) throw new Error('Missing .header-left');
        return el.getBoundingClientRect().width;
      });
      expect(width,
        `${site.name}: header-left should be exactly 240px, got ${width}px`
      ).toBeCloseTo(240, 0);
    }
  });

  test('localhost navigation URLs are set when running on localhost', async ({ page }) => {
    // Verify SiteSwitcher pills point to localhost when served from localhost
    for (const site of SITES) {
      await page.goto(site.url);
      await page.waitForLoadState('networkidle');
      const pillHrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLAnchorElement>('.switcher-pill[href]'))
          .map(a => a.href)
      );
      // Every pill link should point to localhost (not castrojo.github.io)
      for (const href of pillHrefs) {
        expect(href, `${site.name}: SiteSwitcher pill should link to localhost`).toContain('localhost');
      }
    }
  });
});
