import { describe, it, expect, vi, beforeEach } from 'vitest';

// renderMaintainerCard is not yet exported — importing here will fail (RED) until
// the function is exported in maintainer-loader.ts.
describe('renderMaintainerCard — avatar URL', () => {
  beforeEach(() => {
    vi.resetModules();
    // Simulate the Astro base path the module reads from dataset.base
    document.documentElement.dataset.base = '/people-website';
  });

  it('renders an <img> with the GitHub CDN avatar URL from the avatarUrl field', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');

    const m = {
      name: 'Ana Tester',
      handle: 'anatester',
      avatarUrl: 'https://avatars.githubusercontent.com/anatester',
      projects: [],
      maturity: 'Graduated',
    };

    const html = renderMaintainerCard(m, {});

    // Must use the avatarUrl field value — not a freshly-constructed URL
    expect(html).toContain('src="https://avatars.githubusercontent.com/anatester"');
  });

  it('renders an onerror handler that hides the broken image', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');

    const m = {
      name: 'Ana Tester',
      handle: 'anatester',
      avatarUrl: 'https://avatars.githubusercontent.com/anatester',
      projects: [],
      maturity: 'Graduated',
    };

    const html = renderMaintainerCard(m, {});

    // onerror must hide the img and reveal the adjacent placeholder
    expect(html).toContain("onerror=\"this.style.display='none'");
    expect(html).toContain("this.nextElementSibling.style.display='flex'");
  });

  it('renders an avatar-placeholder div with the first initial for graceful fallback', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');

    const m = {
      name: 'Ana Tester',
      handle: 'anatester',
      avatarUrl: 'https://avatars.githubusercontent.com/anatester',
      projects: [],
      maturity: 'Graduated',
    };

    const html = renderMaintainerCard(m, {});

    // A sibling placeholder div must be present, hidden by default, showing first initial
    expect(html).toContain('class="avatar-placeholder"');
    expect(html).toContain('style="display:none"');
    // First initial of "Ana Tester" is "A"
    expect(html).toMatch(/class="avatar-placeholder"[^>]*>A</);
  });
});
