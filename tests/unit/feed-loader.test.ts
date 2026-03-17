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
});
