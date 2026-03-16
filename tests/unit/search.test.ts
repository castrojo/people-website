import { describe, it, expect, vi, afterEach } from 'vitest';

describe('searchPeople — empty/whitespace queries (no fetch)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array for empty query without calling fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    const { searchPeople } = await import('../../src/lib/search');
    const results = await searchPeople('', 'http://localhost/');
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only query without calling fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    const { searchPeople } = await import('../../src/lib/search');
    const results = await searchPeople('   ', 'http://localhost/');
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('searchPeople — with loaded index', () => {
  it('returns matching results from mocked people index', async () => {
    vi.resetModules();

    const mockPeople = [
      { name: 'Jane Doe', handle: 'janedoe', company: 'CNCF', category: ['Ambassadors'] },
      { name: 'John Smith', handle: 'jsmith', company: 'Linux Foundation', category: ['Kubestronaut'] },
      { name: 'Alice Lee', handle: 'aliceLee', company: 'CNCF', location: 'Berlin', category: ['TOC'] },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPeople),
    }));

    const { searchPeople } = await import('../../src/lib/search');

    const results = await searchPeople('Jane', 'http://localhost/');
    expect(results.length).toBeGreaterThan(0);
    const names = results.map(r => r.name);
    expect(names).toContain('Jane Doe');
  });

  it('returns results with expected SearchResult shape', async () => {
    vi.resetModules();

    const mockPeople = [
      { name: 'Bob Builder', handle: 'bobbuilder', company: 'CanWeFix', category: ['Kubestronaut'] },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPeople),
    }));

    const { searchPeople } = await import('../../src/lib/search');

    const results = await searchPeople('Bob', 'http://localhost/');
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('score');
    expect(first).toHaveProperty('terms');
    expect(typeof first.score).toBe('number');
    expect(Array.isArray(first.terms)).toBe(true);
    expect(Array.isArray(first.category)).toBe(true);
  });

  it('respects the limit parameter', async () => {
    vi.resetModules();

    const mockPeople = Array.from({ length: 10 }, (_, i) => ({
      name: `Alice ${i}`,
      handle: `alice${i}`,
      company: 'CNCF',
      category: ['Ambassadors'],
    }));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPeople),
    }));

    const { searchPeople } = await import('../../src/lib/search');

    const results = await searchPeople('Alice', 'http://localhost/', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
