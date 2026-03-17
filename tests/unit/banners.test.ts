import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseBannersYaml } from '../../src/lib/banners';

const FULL_YAML = `
- name: "KubeCon EU 2025"
  link: "https://events.linuxfoundation.org/kubecon-eu/"
  images:
    light-theme: "https://example.com/light.png"
    dark-theme: "https://example.com/dark.png"
- name: "KubeCon NA 2025"
  link: "https://events.linuxfoundation.org/kubecon-na/"
  images:
    light-theme: "https://example.com/na-light.png"
    dark-theme: "https://example.com/na-dark.png"
`;

describe('parseBannersYaml', () => {
  it('returns empty array for empty input', () => {
    expect(parseBannersYaml('')).toEqual([]);
  });

  it('parses a single banner with all fields', () => {
    const yaml = `
- name: "KubeCon EU 2025"
  link: "https://events.linuxfoundation.org/kubecon-eu/"
  images:
    light-theme: "https://example.com/light.png"
    dark-theme: "https://example.com/dark.png"
`;
    const result = parseBannersYaml(yaml);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('KubeCon EU 2025');
    expect(result[0].link).toBe('https://events.linuxfoundation.org/kubecon-eu/');
    expect(result[0].images?.['light-theme']).toBe('https://example.com/light.png');
    expect(result[0].images?.['dark-theme']).toBe('https://example.com/dark.png');
  });

  it('parses multiple banners', () => {
    const result = parseBannersYaml(FULL_YAML);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('KubeCon EU 2025');
    expect(result[1].name).toBe('KubeCon NA 2025');
    expect(result[1].images?.['light-theme']).toBe('https://example.com/na-light.png');
  });

  it('strips double and single quotes from values', () => {
    const yaml = `
- name: 'SingleQuoted'
  link: 'https://example.com'
  images:
    light-theme: 'https://example.com/l.png'
    dark-theme: 'https://example.com/d.png'
`;
    const result = parseBannersYaml(yaml);
    expect(result[0].name).toBe('SingleQuoted');
    expect(result[0].link).toBe('https://example.com');
  });

  it('ignores comment lines and blank lines', () => {
    const yaml = `
# CNCF official banners

- name: "KubeCon Test"
  # inline comment ignored
  link: "https://example.com"
  images:
    light-theme: "https://example.com/l.png"
    dark-theme: "https://example.com/d.png"
`;
    const result = parseBannersYaml(yaml);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('KubeCon Test');
  });

  it('returns banner with no images block as object without images field populated', () => {
    const yaml = `
- name: "Incomplete Banner"
  link: "https://example.com"
`;
    const result = parseBannersYaml(yaml);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Incomplete Banner');
    expect(result[0].images).toBeUndefined();
  });
});

describe('fetchBannersConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns parsed banners when fetch succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(FULL_YAML),
    }));
    const { fetchBannersConfig } = await import('../../src/lib/banners');
    const result = await fetchBannersConfig();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('KubeCon EU 2025');
  });

  it('returns empty array when fetch response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));
    const { fetchBannersConfig } = await import('../../src/lib/banners');
    const result = await fetchBannersConfig();
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { fetchBannersConfig } = await import('../../src/lib/banners');
    const result = await fetchBannersConfig();
    expect(result).toEqual([]);
  });
});

describe('getActiveBanners', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns only KubeCon/CloudNative banners with all required fields', async () => {
    const yaml = `
- name: "KubeCon EU 2025"
  link: "https://events.linuxfoundation.org/kubecon-eu/"
  images:
    light-theme: "https://example.com/light.png"
    dark-theme: "https://example.com/dark.png"
- name: "Some Other Event"
  link: "https://other.example.com"
  images:
    light-theme: "https://other.example.com/l.png"
    dark-theme: "https://other.example.com/d.png"
`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(yaml),
    }));
    const { getActiveBanners } = await import('../../src/lib/banners');
    const result = await getActiveBanners();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('KubeCon EU 2025');
    expect(result[0].lightImage).toBe('https://example.com/light.png');
    expect(result[0].darkImage).toBe('https://example.com/dark.png');
  });

  it('skips banners missing required fields', async () => {
    const yaml = `
- name: "KubeCon Incomplete"
  link: "https://events.linuxfoundation.org/kubecon/"
`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(yaml),
    }));
    const { getActiveBanners } = await import('../../src/lib/banners');
    const result = await getActiveBanners();
    expect(result).toEqual([]);
  });
});
