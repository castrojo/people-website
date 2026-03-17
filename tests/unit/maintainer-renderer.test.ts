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

describe('renderMaintainerCard — card content', () => {
  const baseMaintainer = {
    name: 'Priya Sharma',
    handle: 'priyasharma',
    avatarUrl: 'https://avatars.githubusercontent.com/priyasharma',
    projects: ['Kubernetes'],
    maturity: 'Graduated',
  };

  beforeEach(() => {
    vi.resetModules();
    document.documentElement.dataset.base = '/people-website';
  });

  it('renders the person name', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const html = renderMaintainerCard(baseMaintainer, {});
    expect(html).toContain('Priya Sharma');
  });

  it('renders the @handle link', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const html = renderMaintainerCard(baseMaintainer, {});
    expect(html).toContain('@priyasharma');
  });

  it('renders a company chip when company is set', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const m = { ...baseMaintainer, company: 'Google' };
    const html = renderMaintainerCard(m, {});
    expect(html).toContain('company-chip');
    expect(html).toContain('Google');
  });

  it('renders a bio paragraph when bio is set', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const m = { ...baseMaintainer, bio: 'Open source contributor' };
    const html = renderMaintainerCard(m, {});
    expect(html).toContain('class="bio"');
    expect(html).toContain('Open source contributor');
  });

  it('renders location and country flag when set', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const m = { ...baseMaintainer, location: 'Bangalore, India', countryFlag: '🇮🇳' };
    const html = renderMaintainerCard(m, {});
    expect(html).toContain('location-right');
    expect(html).toContain('Bangalore, India');
    expect(html).toContain('🇮🇳');
  });

  it('renders the Graduated accent color #FFB300', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const html = renderMaintainerCard(baseMaintainer, {});
    expect(html).toContain('#FFB300');
  });

  it('renders the Incubating accent color #0086FF', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const m = { ...baseMaintainer, maturity: 'Incubating' };
    const html = renderMaintainerCard(m, {});
    expect(html).toContain('#0086FF');
  });

  it('renders yearsContributing stats chip when set', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const currentYear = new Date().getFullYear();
    const m = { ...baseMaintainer, yearsContributing: 4 };
    const html = renderMaintainerCard(m, {});
    expect(html).toContain('stats-row');
    expect(html).toContain(`Since ${currentYear - 4}`);
    expect(html).toContain('(4y)');
  });

  it('renders project chip names in the projects row', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const html = renderMaintainerCard(baseMaintainer, {});
    expect(html).toContain('projects-row');
    expect(html).toContain('Kubernetes');
  });

  it('renders Maintainer badge', async () => {
    const { renderMaintainerCard } = await import('../../src/lib/maintainer-loader');
    const html = renderMaintainerCard(baseMaintainer, {});
    expect(html).toContain('Maintainer');
    expect(html).toContain('badge-category');
  });
});

describe('resolveLogoUrl', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.dataset.base = '/people-website';
  });

  it('returns the logo URL for an exact lowercase key match', async () => {
    const { resolveLogoUrl } = await import('../../src/lib/maintainer-loader');
    const logos = { kubernetes: 'https://example.com/k8s.svg' };
    expect(resolveLogoUrl('Kubernetes', logos)).toBe('https://example.com/k8s.svg');
  });

  it('returns empty string when no match is found', async () => {
    const { resolveLogoUrl } = await import('../../src/lib/maintainer-loader');
    expect(resolveLogoUrl('UnknownProject', {})).toBe('');
  });

  it('matches by prefix before a colon', async () => {
    const { resolveLogoUrl } = await import('../../src/lib/maintainer-loader');
    const logos = { prometheus: 'https://example.com/prom.svg' };
    expect(resolveLogoUrl('Prometheus: Alertmanager', logos)).toBe('https://example.com/prom.svg');
  });

  it('matches by prefix before a parenthesis', async () => {
    const { resolveLogoUrl } = await import('../../src/lib/maintainer-loader');
    const logos = { helm: 'https://example.com/helm.svg' };
    expect(resolveLogoUrl('Helm (Charts)', logos)).toBe('https://example.com/helm.svg');
  });
});
