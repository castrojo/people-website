import { describe, it, expect } from 'vitest';
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
