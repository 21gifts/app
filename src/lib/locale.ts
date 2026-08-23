/** Supported UI locales (BCP-47 primary tags; Filipino is `fil`). */
export const LOCALES = ['en', 'de', 'es', 'fil'] as const;

/** A supported UI locale. */
export type Locale = (typeof LOCALES)[number];

/** Fallback when Accept-Language is empty or unmatched. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie name written only when the visitor picks a language in the switcher. */
export const LOCALE_COOKIE = 'locale';

/** Primary-language subtag → supported locale (`tl` maps to Filipino). */
const PRIMARY_TO_LOCALE: Record<string, Locale> = {
  en: 'en',
  de: 'de',
  es: 'es',
  fil: 'fil',
  tl: 'fil',
};

/**
 * Negotiate a supported locale from an RFC 7231 Accept-Language header.
 *
 * Splits on commas, reads `q=` (default 1), sorts by q descending then header
 * order. Each tag's primary subtag is lowercased. Map: en→en, de→de, es→es,
 * fil→fil, tl→fil. First mapped tag wins. Empty, missing, or unmatched → `en`.
 *
 * @param header - Raw Accept-Language or empty string.
 * @returns A supported locale.
 */
export function parseAcceptLanguage(header: string): Locale {
  if (header.trim() === '') {
    return DEFAULT_LOCALE;
  }

  const parts = header.split(',');
  const entries: Array<{ primary: string; q: number; index: number }> = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    /* v8 ignore next 3 — noUncheckedIndexedAccess on a 0..length-1 index */
    if (part === undefined) {
      continue;
    }
    const trimmed = part.trim();
    if (trimmed === '') {
      continue;
    }
    const [rawTag, ...params] = trimmed.split(';');
    if (rawTag === undefined || rawTag.trim() === '') {
      continue;
    }
    let q = 1;
    for (const param of params) {
      const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
      if (match !== null && match[1] !== undefined) {
        const parsed = Number.parseFloat(match[1]);
        if (Number.isFinite(parsed)) {
          q = parsed;
        }
      }
    }
    if (q <= 0) {
      continue;
    }
    const first = rawTag.trim().split('-')[0];
    /* v8 ignore next 3 — split always yields at least one element */
    if (first === undefined) {
      continue;
    }
    if (first === '') {
      continue;
    }
    const primary = first.toLowerCase();
    entries.push({ primary, q, index });
  }

  entries.sort((a, b) => {
    if (b.q !== a.q) {
      return b.q - a.q;
    }
    return a.index - b.index;
  });

  for (const entry of entries) {
    const mapped = PRIMARY_TO_LOCALE[entry.primary];
    if (mapped !== undefined) {
      return mapped;
    }
  }

  return DEFAULT_LOCALE;
}
