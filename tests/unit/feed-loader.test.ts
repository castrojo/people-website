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
