// countryFlag.ts
// Converts the country portion of a freeform location string to a flag emoji.
// Uses i18n-iso-countries for the name→ISO mapping (handles case, aliases,
// many language variants). A small override map covers typos/French spellings
// present in the cncf/people dataset.

import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

// Overrides for entries the library doesn't cover (typos / non-English spellings)
const OVERRIDES: Record<string, string> = {
  'Tunisie':              'TN', // French spelling
  'United Arab Emirate':  'AE', // singular typo in source data
  'United of States':     'US', // typo in source data
};

/** Convert ISO 3166-1 alpha-2 code to flag emoji via Regional Indicator Symbols. */
function codeToFlag(code: string): string {
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join('');
}

/**
 * Given a raw location string (e.g. "Berlin, Germany" or "NYC, NY, USA"),
 * return the flag emoji for the country portion, or empty string if unknown.
 */
export function locationFlag(location: string): string {
  if (!location) return '';
  const raw = location.split(',').at(-1)?.trim() ?? '';
  if (!raw) return '';

  const override = OVERRIDES[raw] ?? OVERRIDES[raw.trim()];
  if (override) return codeToFlag(override);

  const code = countries.getAlpha2Code(raw, 'en');
  return code ? codeToFlag(code) : '';
}
