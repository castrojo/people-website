// banners.ts — fetch and parse CNCF banner config from cncf.github.io/banners at build time.

export interface BannerConfig {
  name: string;
  link: string;
  lightImage: string;
  darkImage: string;
}

interface RawBanner {
  name?: string;
  link?: string;
  images?: {
    'light-theme'?: string;
    'dark-theme'?: string;
  };
}

/**
 * Minimal inline parser for banners.yml.
 *
 * Handles exactly this structure (no js-yaml dependency needed):
 *
 *   - name: "Foo"
 *     link: "https://..."
 *     images:
 *       light-theme: "https://..."
 *       dark-theme: "https://..."
 *
 * Rules:
 * - Lines starting with "- " begin a new banner object
 * - Key-value lines: `  key: value` (leading whitespace ignored)
 * - Nested `images:` block: next lines with deeper indent are sub-keys
 * - Values may be quoted with single or double quotes (stripped)
 * - Blank lines and comment lines (#) are ignored
 */
export function parseBannersYaml(yamlText: string): RawBanner[] {
  const banners: RawBanner[] = [];
  let current: RawBanner | null = null;
  let inImages = false;
  const stripQuotes = (s: string): string => s.replace(/^['"]|['"]$/g, '').trim();

  for (const rawLine of yamlText.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // New top-level list item
    if (/^- /.test(line)) {
      if (current) banners.push(current);
      current = {};
      inImages = false;
      const rest = line.slice(2).trim();
      const colonIdx = rest.indexOf(':');
      if (colonIdx !== -1) {
        const k = rest.slice(0, colonIdx).trim();
        const v = rest.slice(colonIdx + 1).trim();
        if (k && v) (current as Record<string, unknown>)[k] = stripQuotes(v);
      }
      continue;
    }

    if (!current) continue;

    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();

    // Entering images block
    if (key === 'images' && !val) {
      inImages = true;
      current.images = {};
      continue;
    }

    if (inImages && current.images) {
      // Detect end of images block: line indented less than image sub-keys
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (indent <= 2) {
        inImages = false;
        // Fall through to handle as top-level key
      } else {
        if (key === 'light-theme') current.images['light-theme'] = stripQuotes(val);
        else if (key === 'dark-theme') current.images['dark-theme'] = stripQuotes(val);
        continue;
      }
    }

    if (key === 'name') current.name = stripQuotes(val);
    else if (key === 'link') current.link = stripQuotes(val);
  }

  if (current) banners.push(current);
  return banners;
}

/** Fetches banners.yml from CNCF — returns empty array on error. */
export async function fetchBannersConfig(): Promise<RawBanner[]> {
  try {
    const response = await fetch('https://cncf.github.io/banners/banners.yml');
    if (!response.ok) {
      console.warn(`Failed to fetch banners.yml: ${response.status} ${response.statusText}`);
      return [];
    }
    const yamlText = await response.text();
    return parseBannersYaml(yamlText);
  } catch (error) {
    console.warn('Error fetching CNCF banners:', error);
    return [];
  }
}

/** Returns the first active KubeCon banner, or null. */
export const getActiveBanner = async (): Promise<BannerConfig | null> =>
  (await getActiveBanners())[0] ?? null;

/**
 * Get all active KubeCon banners from CNCF configuration.
 * Returns empty array if none available.
 */
export async function getActiveBanners(): Promise<BannerConfig[]> {
  const banners = (await fetchBannersConfig()).filter(b =>
    b.name?.includes('KubeCon') || b.name?.includes('CloudNative')
  );
  return banners.flatMap(b => {
    if (!b.name || !b.link || !b.images?.['light-theme'] || !b.images?.['dark-theme']) {
      console.warn('Banner missing required fields, skipping:', b);
      return [];
    }
    return [{ name: b.name, link: b.link, lightImage: b.images['light-theme'], darkImage: b.images['dark-theme'] }];
  });
}
