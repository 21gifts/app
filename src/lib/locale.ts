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

/** RFC 4647 Basic Language Range (excludes the wildcard `*`). */
const BASIC_LANGUAGE_RANGE = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;

type Assignment = { q: number; index: number; star: boolean };

/**
 * Negotiate a supported locale from an RFC 7231 Accept-Language header.
 *
 * Parses comma-separated language-ranges with optional `q=` (default 1). A
 * `q=` value must be a single HTTP qvalue
 * (`^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$`); a bare `q`, an empty/invalid
 * value, or a duplicate `q` discards the entire language-range. Valid tags are either
 * the wildcard `*` or an RFC 4647 Basic Language Range matching
 * `/^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/`. Primary subtags are lowercased
 * and mapped: en→en, de→de, es→es, fil→fil, tl→fil.
 *
 * Scoring: each supported locale gets at most one assignment `{ q, index, star }`.
 * `*` assigns every locale that has no specific assignment yet (or only a
 * prior `*`), competing by higher q then smaller index. Specific ranges
 * always overwrite `*`; among specifics, higher q wins, then smaller index.
 * `q=0` excludes a locale. Among assignments with `q > 0`, pick highest q,
 * then smallest index, then `LOCALES` order. No positive assignment →
 * `DEFAULT_LOCALE` (`en`).
 *
 * @param header - Raw Accept-Language or empty string.
 * @returns A supported locale.
 */
export function parseAcceptLanguage(header: string): Locale {
  if (header.trim() === '') {
    return DEFAULT_LOCALE;
  }

  const parts = header.split(',');
  const assignments = new Map<Locale, Assignment>();

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
    /* v8 ignore next 3 — noUncheckedIndexedAccess on a 0..length-1 index */
    if (rawTag === undefined) {
      continue;
    }
    const tag = rawTag.trim();
    if (tag === '') {
      continue;
    }
    let q = 1;
    let invalidQ = false;
    let seenQ = false;
    for (const param of params) {
      const match = /^\s*q(?:\s*=(.*))?$/i.exec(param);
      if (match === null) {
        continue;
      }
      if (seenQ) {
        invalidQ = true;
        break;
      }
      seenQ = true;
      const token = match[1]?.trim();
      if (
        token === undefined ||
        token === '' ||
        !/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(token)
      ) {
        invalidQ = true;
        break;
      }
      q = Number(token);
    }
    if (invalidQ) {
      continue;
    }

    if (tag === '*') {
      for (const locale of LOCALES) {
        const assigned = assignments.get(locale);
        // Header order: equal q keeps the earlier (smaller) index.
        if (assigned === undefined || (assigned.star && q > assigned.q)) {
          assignments.set(locale, { q, index, star: true });
        }
      }
      continue;
    }

    if (!BASIC_LANGUAGE_RANGE.test(tag)) {
      continue;
    }

    const segments = tag.split('-');
    const first = segments[0];
    /* v8 ignore next 3 — Basic Range regex guarantees a non-empty first subtag */
    if (first === undefined) {
      continue;
    }
    const primary = first.toLowerCase();
    const mapped = PRIMARY_TO_LOCALE[primary];
    if (mapped === undefined) {
      continue;
    }

    const assigned = assignments.get(mapped);
    // Specific always overwrites *; equal q keeps earlier (smaller) index.
    if (assigned === undefined || assigned.star || q > assigned.q) {
      assignments.set(mapped, { q, index, star: false });
    }
  }

  let best: Locale | undefined;
  let bestQ = -1;
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const locale of LOCALES) {
    const assigned = assignments.get(locale);
    if (assigned === undefined || assigned.q <= 0) {
      continue;
    }
    if (assigned.q > bestQ || (assigned.q === bestQ && assigned.index < bestIndex)) {
      best = locale;
      bestQ = assigned.q;
      bestIndex = assigned.index;
    }
  }

  return best ?? DEFAULT_LOCALE;
}
