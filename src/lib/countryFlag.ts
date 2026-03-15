// countryFlag.ts
// Maps country name strings (as they appear in cncf/people location fields)
// to ISO 3166-1 alpha-2 codes, then derives the flag emoji from those codes.

const COUNTRY_CODES: Record<string, string> = {
  // Full names
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Argentina': 'AR',
  'Armenia': 'AM', 'Australia': 'AU', 'Austria': 'AT', 'Azerbaijan': 'AZ',
  'Bahrain': 'BH', 'Bangladesh': 'BD', 'Belarus': 'BY', 'Belgium': 'BE',
  'Bolivia': 'BO', 'Bosnia and Herzegovina': 'BA', 'Brazil': 'BR',
  'Bulgaria': 'BG', 'Canada': 'CA', 'Chile': 'CL', 'China': 'CN',
  'Colombia': 'CO', 'Costa Rica': 'CR', 'Croatia': 'HR', 'Cyprus': 'CY',
  'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Denmark': 'DK',
  'Dominican Republic': 'DO', 'Ecuador': 'EC', 'Egypt': 'EG',
  'El Salvador': 'SV', 'Estonia': 'EE', 'Finland': 'FI', 'France': 'FR',
  'Georgia': 'GE', 'Germany': 'DE', 'Greece': 'GR', 'Guatemala': 'GT',
  'Hong Kong': 'HK', 'Hungary': 'HU', 'India': 'IN', 'Indonesia': 'ID',
  'Iraq': 'IQ', 'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT',
  'Japan': 'JP', 'Jordan': 'JO', 'Kazakhstan': 'KZ', 'Kenya': 'KE',
  'Kosovo': 'XK', 'Kuwait': 'KW', 'Latvia': 'LV', 'Lithuania': 'LT',
  'Luxembourg': 'LU', 'Madagascar': 'MG', 'Malaysia': 'MY',
  'Mexico': 'MX', 'Moldova': 'MD', 'Mongolia': 'MN', 'Morocco': 'MA',
  'Mozambique': 'MZ', 'Myanmar': 'MM', 'Nepal': 'NP',
  'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nicaragua': 'NI',
  'Nigeria': 'NG', 'Norway': 'NO', 'Pakistan': 'PK', 'Palestine': 'PS',
  'Panama': 'PA', 'Paraguay': 'PY', 'Peru': 'PE', 'Philippines': 'PH',
  'Poland': 'PL', 'Portugal': 'PT', 'Qatar': 'QA', 'Romania': 'RO',
  'Russia': 'RU', 'Russian Federation': 'RU', 'Saudi Arabia': 'SA',
  'Senegal': 'SN', 'Serbia': 'RS', 'Singapore': 'SG', 'Slovakia': 'SK',
  'Slovenia': 'SI', 'South Africa': 'ZA', 'South Korea': 'KR',
  'Spain': 'ES', 'Sri Lanka': 'LK', 'Sweden': 'SE', 'Switzerland': 'CH',
  'Taiwan': 'TW', 'Thailand': 'TH', 'Tunisia': 'TN', 'Turkey': 'TR',
  'Türkiye': 'TR', 'Uganda': 'UG', 'Ukraine': 'UA',
  'United Arab Emirates': 'AE', 'United Arab Emirate': 'AE',
  'United Kingdom': 'GB', 'United States': 'US', 'United States of America': 'US',
  'Vietnam': 'VN', 'Zimbabwe': 'ZW',
  // Common aliases / abbreviations
  'USA': 'US', 'UK': 'GB', 'UAE': 'AE',
  'Tunisie': 'TN',
};

/** Convert ISO 3166-1 alpha-2 code to flag emoji. */
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
  // Normalize: trim, collapse internal spaces, lowercase for lookup
  const normalized = raw.replace(/\s+/g, ' ').trim();
  const code =
    COUNTRY_CODES[normalized] ??
    COUNTRY_CODES[normalized.toUpperCase()] ??
    // Case-insensitive fallback
    Object.entries(COUNTRY_CODES).find(
      ([k]) => k.toLowerCase() === normalized.toLowerCase()
    )?.[1];
  return code ? codeToFlag(code) : '';
}
