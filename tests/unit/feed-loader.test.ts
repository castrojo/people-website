import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('esc — HTML escaping', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.dataset.base = '/people-website';
  });

  it('returns a plain string unchanged', async () => {
    const { esc } = await import('../../src/lib/feed-loader');
    expect(esc('hello world')).toBe('hello world');
  });

  it('escapes ampersands', async () => {
    const { esc } = await import('../../src/lib/feed-loader');
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes < and > angle brackets', async () => {
    const { esc } = await import('../../src/lib/feed-loader');
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', async () => {
    const { esc } = await import('../../src/lib/feed-loader');
    expect(esc('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('escapes all special chars in a combined string', async () => {
    const { esc } = await import('../../src/lib/feed-loader');
    expect(esc('<a href="x&y">')).toBe('&lt;a href=&quot;x&amp;y&quot;&gt;');
  });
});

describe('dateHeader — timestamp formatting', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.dataset.base = '/people-website';
  });

  it('formats a known UTC timestamp to a long date string', async () => {
    const { dateHeader } = await import('../../src/lib/feed-loader');
    // 2024-03-15T00:00:00Z is a Friday
    const result = dateHeader('2024-03-15T00:00:00Z');
    expect(result).toContain('March');
    expect(result).toContain('2024');
    expect(result).toContain('15');
    expect(result).toContain('Friday');
  });

  it('returns a non-empty string for a valid ISO timestamp', async () => {
    const { dateHeader } = await import('../../src/lib/feed-loader');
    expect(dateHeader('2023-01-01T12:00:00Z').length).toBeGreaterThan(0);
  });

  it('includes the weekday name', async () => {
    const { dateHeader } = await import('../../src/lib/feed-loader');
    // 2025-06-16T00:00:00Z is a Monday
    const result = dateHeader('2025-06-16T00:00:00Z');
    expect(result).toContain('Monday');
  });
});

describe('renderCard — person card HTML', () => {
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

  it('renders the person name', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const html = renderCard(baseEvent as any, {});
    expect(html).toContain('Kaito Yamamoto');
  });

  it('renders the GitHub handle with @-prefix', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const html = renderCard(baseEvent as any, {});
    expect(html).toContain('@kaitoy');
  });

  it('renders the avatar img with the avatarUrl src', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const html = renderCard(baseEvent as any, {});
    expect(html).toContain('src="https://avatars.githubusercontent.com/kaitoy"');
  });

  it('renders the + Joined badge for type "added"', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const html = renderCard(baseEvent as any, {});
    expect(html).toContain('+ Joined');
  });

  it('renders the − Left badge for type "removed"', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, type: 'removed' };
    const html = renderCard(event as any, {});
    expect(html).toContain('− Left');
  });

  it('renders the Kubestronaut category badge', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const html = renderCard(baseEvent as any, {});
    expect(html).toContain('Kubestronaut');
  });

  it('renders the Kubestronaut accent color', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const html = renderCard(baseEvent as any, {});
    expect(html).toContain('--card-accent:var(--color-kubestronaut, #D62293)');
  });

  it('renders GitHub social link when github is set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const html = renderCard(baseEvent as any, {});
    expect(html).toContain('href="https://github.com/kaitoy"');
  });

  it('renders bio text when person has a bio', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, bio: 'Cloud native enthusiast' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('Cloud native enthusiast');
  });

  it('renders a company chip when person has a company', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, company: 'Red Hat' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('Red Hat');
    expect(html).toContain('company-chip');
  });

  it('renders pronouns when set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, pronouns: 'they/them' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('(they/them)');
  });

  it('renders avatar-placeholder with first initial when avatarUrl is absent', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const { avatarUrl: _, ...personNoAvatar } = baseEvent.person as any;
    const event = { ...baseEvent, person: { ...personNoAvatar } };
    const html = renderCard(event as any, {});
    expect(html).toContain('avatar-placeholder');
    expect(html).toContain('>K<'); // First initial of "Kaito"
  });

  it('renders ✎ Updated badge for type "updated"', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, type: 'updated' };
    const html = renderCard(event as any, {});
    expect(html).toContain('✎ Updated');
  });

  it('renders LinkedIn social link when linkedin is set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, linkedin: 'https://linkedin.com/in/kaitoy' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('href="https://linkedin.com/in/kaitoy"');
  });

  it('renders location in the right column when set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, location: 'Tokyo, Japan', countryFlag: '🇯🇵' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('location-right');
    expect(html).toContain('Tokyo, Japan');
    expect(html).toContain('🇯🇵');
  });

  it('renders stats row with contributions when set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, contributions: 1234 } };
    const html = renderCard(event as any, {});
    expect(html).toContain('stats-row');
    expect(html).toContain('1,234');
    expect(html).toContain('contributions');
  });

  it('renders stats row with public repos when set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, publicRepos: 42 } };
    const html = renderCard(event as any, {});
    expect(html).toContain('stats-row');
    expect(html).toContain('>42<');
    expect(html).toContain('repos');
  });

  it('renders stats row with years contributing when set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const currentYear = new Date().getFullYear();
    const event = { ...baseEvent, person: { ...baseEvent.person, yearsContributing: 5 } };
    const html = renderCard(event as any, {});
    expect(html).toContain('stats-row');
    expect(html).toContain(`Since ${currentYear - 5}`);
    expect(html).toContain('(5y)');
  });

  it('omits stats row when no stats fields are set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const html = renderCard(baseEvent as any, {});
    expect(html).not.toContain('stats-row');
  });

  it('renders projects row with project chips when projects are set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, projects: ['Kubernetes', 'Prometheus'] } };
    const html = renderCard(event as any, {});
    expect(html).toContain('projects-row');
    expect(html).toContain('Kubernetes');
    expect(html).toContain('Prometheus');
  });

  it('renders changes details when event has changes', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = {
      ...baseEvent,
      type: 'updated',
      changes: [{ field: 'company', from: 'OldCorp', to: 'NewCorp' }],
    };
    const html = renderCard(event as any, {});
    expect(html).toContain('changes-details');
    expect(html).toContain('1 field changed');
    expect(html).toContain('OldCorp');
    expect(html).toContain('NewCorp');
  });

  it('renders plural "fields changed" for multiple changes', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = {
      ...baseEvent,
      type: 'updated',
      changes: [
        { field: 'company', from: 'OldCorp', to: 'NewCorp' },
        { field: 'bio', from: 'Old bio', to: 'New bio' },
      ],
    };
    const html = renderCard(event as any, {});
    expect(html).toContain('2 fields changed');
  });

  it('renders Twitter social link when twitter is set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, twitter: 'https://twitter.com/kaitoy' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('href="https://twitter.com/kaitoy"');
    expect(html).toContain('Twitter/X');
  });

  it('renders Bluesky social link when bluesky is set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, bluesky: 'https://bsky.app/profile/kaitoy' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('href="https://bsky.app/profile/kaitoy"');
    expect(html).toContain('Bluesky');
  });

  it('renders YouTube social link when youtube is set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, youtube: 'https://youtube.com/@kaitoy' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('href="https://youtube.com/@kaitoy"');
    expect(html).toContain('YouTube');
  });

  it('escapes HTML special characters in name to prevent XSS', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, name: '<script>alert("xss")</script>' } };
    const html = renderCard(event as any, {});
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML special characters in bio to prevent XSS', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, bio: 'Hello & <world>' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('Hello &amp; &lt;world&gt;');
    expect(html).not.toContain('<world>');
  });

  it('renders project chip with landscape logo img when logo is provided', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, projects: ['Prometheus'] } };
    const logos = { Prometheus: 'https://logos.example.com/prometheus.svg' };
    const html = renderCard(event as any, logos);
    expect(html).toContain('projects-row');
    expect(html).toContain('Prometheus');
    expect(html).toContain('src="https://logos.example.com/prometheus.svg"');
  });

  it('renders certDirectory link when certDirectory is set', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, certDirectory: 'https://cncf.io/certs/kaitoy' } };
    const html = renderCard(event as any, {});
    expect(html).toContain('href="https://cncf.io/certs/kaitoy"');
    expect(html).toContain('CNCF Cert Directory');
  });

  it('renders multiple category badges for multi-category person', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, category: ['Kubestronaut', 'Ambassadors'] } };
    const html = renderCard(event as any, {});
    expect(html).toContain('Kubestronaut');
    expect(html).toContain('Ambassador');
  });

  it('renders data-categories attribute with pipe-separated lowercase categories', async () => {
    const { renderCard } = await import('../../src/lib/feed-loader');
    const event = { ...baseEvent, person: { ...baseEvent.person, category: ['Kubestronaut', 'Ambassadors'] } };
    const html = renderCard(event as any, {});
    expect(html).toContain('data-categories="kubestronaut|ambassadors"');
  });
});
