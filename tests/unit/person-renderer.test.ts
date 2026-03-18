import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('person-renderer', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.dataset.base = '/people-website';
  });

  const baseEvent = {
    id: 'ev-001',
    type: 'added',
    timestamp: '2024-06-15T10:30:00Z',
    person: {
      name: 'Kaito Yamamoto',
      handle: 'kaitoy',
      github: 'https://github.com/kaitoy',
      avatarUrl: 'https://avatars.githubusercontent.com/kaitoy',
      category: ['Kubestronaut'],
    },
  };

  // ── type labels ──────────────────────────────────────────────────────────
  it('renders "+ Joined" badge for type "added"', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const html = renderPersonCard(baseEvent as any, {});
    expect(html).toContain('+ Joined');
  });

  it('renders "Emeritus" badge for type "removed" (canonical CNCF term)', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, type: 'removed' };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('Emeritus');
    expect(html).not.toContain('− Left');
  });

  it('renders "✎ Updated" badge for type "updated"', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, type: 'updated' };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('✎ Updated');
  });

  // ── identity ─────────────────────────────────────────────────────────────
  it('renders the person name', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const html = renderPersonCard(baseEvent as any, {});
    expect(html).toContain('Kaito Yamamoto');
  });

  it('renders the GitHub handle with @-prefix', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const html = renderPersonCard(baseEvent as any, {});
    expect(html).toContain('@kaitoy');
  });

  it('renders pronouns when set', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, pronouns: 'she/her' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('(she/her)');
  });

  it('renders avatar img with avatarUrl src', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const html = renderPersonCard(baseEvent as any, {});
    expect(html).toContain('src="https://avatars.githubusercontent.com/kaitoy"');
  });

  it('renders avatar-placeholder with first initial when no avatar', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const { avatarUrl: _, ...personNoAvatar } = baseEvent.person as any;
    const event = { ...baseEvent, person: { ...personNoAvatar } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('avatar-placeholder');
    expect(html).toContain('>K<');
  });

  it('renders bio text', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, bio: 'Cloud native enthusiast' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('Cloud native enthusiast');
  });

  it('renders company chip without link when no companyLandscapeUrl', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, company: 'Red Hat' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('Red Hat');
    expect(html).toContain('company-chip');
  });

  it('renders company chip as link when companyLandscapeUrl is set', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, company: 'Red Hat', companyLandscapeUrl: 'https://landscape.cncf.io/card/red-hat' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('href="https://landscape.cncf.io/card/red-hat"');
    expect(html).toContain('company-chip-link');
  });

  // ── categories ────────────────────────────────────────────────────────────
  it('renders Kubestronaut category badge', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const html = renderPersonCard(baseEvent as any, {});
    expect(html).toContain('Kubestronaut');
    expect(html).toContain('badge-category');
  });

  it('renders Kubestronaut accent color in card style', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const html = renderPersonCard(baseEvent as any, {});
    expect(html).toContain('--card-accent:var(--color-kubestronaut, #D62293)');
  });

  it('renders data-categories attribute pipe-separated lowercase', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, category: ['Kubestronaut', 'Ambassadors'] } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('data-categories="kubestronaut|ambassadors"');
  });

  it('renders multiple category badges for multi-category person', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, category: ['Kubestronaut', 'Ambassadors'] } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('Kubestronaut');
    expect(html).toContain('Ambassador');
  });

  // ── stats row ─────────────────────────────────────────────────────────────
  it('renders stats row with contributions', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, contributions: 1234 } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('stats-row');
    expect(html).toContain('1,234');
    expect(html).toContain('contributions');
  });

  it('renders stats row with public repos', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, publicRepos: 42 } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('stats-row');
    expect(html).toContain('>42<');
    expect(html).toContain('repos');
  });

  it('renders stats row with years contributing', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const currentYear = new Date().getFullYear();
    const event = { ...baseEvent, person: { ...baseEvent.person, yearsContributing: 5 } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('stats-row');
    expect(html).toContain(`Since ${currentYear - 5}`);
    expect(html).toContain('(5y)');
  });

  it('omits stats row when no stats fields are set', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const html = renderPersonCard(baseEvent as any, {});
    expect(html).not.toContain('stats-row');
  });

  // ── projects ──────────────────────────────────────────────────────────────
  it('renders projects row with project chips', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, projects: ['Kubernetes', 'Prometheus'] } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('projects-row');
    expect(html).toContain('Kubernetes');
    expect(html).toContain('Prometheus');
  });

  it('renders project chip with logo from landscapeLogos', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, projects: ['Prometheus'] } };
    const logos = { Prometheus: 'https://logos.example.com/prometheus.svg' };
    const html = renderPersonCard(event as any, logos);
    expect(html).toContain('src="https://logos.example.com/prometheus.svg"');
    expect(html).toContain('Prometheus');
  });

  // ── changes ───────────────────────────────────────────────────────────────
  it('renders changes details when event has changes', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = {
      ...baseEvent,
      type: 'updated',
      changes: [{ field: 'company', from: 'OldCorp', to: 'NewCorp' }],
    };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('changes-details');
    expect(html).toContain('1 field changed');
    expect(html).toContain('OldCorp');
    expect(html).toContain('NewCorp');
  });

  it('renders plural "fields changed" for multiple changes', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = {
      ...baseEvent, type: 'updated',
      changes: [{ field: 'company', from: 'A', to: 'B' }, { field: 'bio', from: 'X', to: 'Y' }],
    };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('2 fields changed');
  });

  // ── right column ──────────────────────────────────────────────────────────
  it('renders location and country flag in card-right', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, location: 'Tokyo, Japan', countryFlag: '🇯🇵' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('location-right');
    expect(html).toContain('Tokyo, Japan');
    expect(html).toContain('🇯🇵');
  });

  // ── social links ──────────────────────────────────────────────────────────
  it('renders GitHub social link when github is set', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const html = renderPersonCard(baseEvent as any, {});
    expect(html).toContain('href="https://github.com/kaitoy"');
  });

  it('renders LinkedIn social link', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, linkedin: 'https://linkedin.com/in/kaitoy' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('href="https://linkedin.com/in/kaitoy"');
  });

  it('renders Twitter social link', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, twitter: 'https://twitter.com/kaitoy' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('href="https://twitter.com/kaitoy"');
    expect(html).toContain('Twitter/X');
  });

  it('renders Bluesky social link', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, bluesky: 'https://bsky.app/profile/kaitoy' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('href="https://bsky.app/profile/kaitoy"');
    expect(html).toContain('Bluesky');
  });

  it('renders YouTube social link', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, youtube: 'https://youtube.com/@kaitoy' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('href="https://youtube.com/@kaitoy"');
    expect(html).toContain('YouTube');
  });

  it('renders certDirectory link', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, certDirectory: 'https://cncf.io/certs/kaitoy' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('href="https://cncf.io/certs/kaitoy"');
    expect(html).toContain('CNCF Cert Directory');
  });

  // ── XSS / escaping ────────────────────────────────────────────────────────
  it('escapes HTML in name to prevent XSS', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, name: '<script>alert("xss")</script>' } };
    const html = renderPersonCard(event as any, {});
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in bio to prevent XSS', async () => {
    const { renderPersonCard } = await import('../../src/lib/person-renderer');
    const event = { ...baseEvent, person: { ...baseEvent.person, bio: 'Hello & <world>' } };
    const html = renderPersonCard(event as any, {});
    expect(html).toContain('Hello &amp; &lt;world&gt;');
    expect(html).not.toContain('<world>');
  });

  // ── shared utilities ──────────────────────────────────────────────────────
  it('exports esc() for HTML escaping', async () => {
    const { esc } = await import('../../src/lib/person-renderer');
    expect(esc('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });

  it('exports dateHeader() formatting a UTC timestamp', async () => {
    const { dateHeader } = await import('../../src/lib/person-renderer');
    const result = dateHeader('2024-03-15T00:00:00Z');
    expect(result).toContain('March');
    expect(result).toContain('2024');
    expect(result).toContain('Friday');
  });
});
