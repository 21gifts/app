import type { ForumPlaceRow } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';

/** One country in the Shops country filter. */
export type ShopCountryOption = {
  /** ISO 3166-1 alpha-2 code, as the api returns it. */
  code: string;
  /** Name of the country in the UI language. */
  name: string;
  /** Shops pinned in that country, or null while the pins are still loading. */
  count: number | null;
};

/**
 * Two-letter region codes that `Intl.DisplayNames` names but that are not a
 * country of ISO 3166-1 alpha-2: groupings (`EU`, `EZ`, `UN`, `QO`), test and
 * unknown codes (`XA`, `XB`, `ZZ`), and exceptionally reserved areas the api
 * never returns (`AC`, `CP`, `CQ`, `DG`, `EA`, `IC`, `TA`). `XK` (Kosovo) stays:
 * the api uses it.
 */
const NOT_A_COUNTRY: ReadonlySet<string> = new Set([
  'AC',
  'CP',
  'CQ',
  'DG',
  'EA',
  'EU',
  'EZ',
  'IC',
  'QO',
  'TA',
  'UN',
  'XA',
  'XB',
  'ZZ',
]);

/**
 * Region names in the UI language. `fallback: 'none'` makes an unknown code
 * `undefined` instead of echoing it back.
 *
 * @param locale - UI language.
 * @returns The display-name formatter.
 */
function regionNames(locale: Locale): Intl.DisplayNames {
  return new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' });
}

/**
 * Country code from the `country` query of `/shops`.
 *
 * Two letters in any case that name a country (a region `Intl.DisplayNames`
 * knows that is not a grouping such as `EU`). Anything else (missing, blank,
 * longer, digits, an unassigned code, or a grouping) is no country, so the page
 * shows all countries.
 *
 * @param raw - `URLSearchParams.get('country')`.
 * @returns The upper-case code, or null for All countries.
 */
export function shopCountryFromQuery(raw: string | null): string | null {
  if (raw === null || !/^[A-Za-z]{2}$/.test(raw)) {
    return null;
  }
  const code = raw.toUpperCase();
  return NOT_A_COUNTRY.has(code) || regionNames('en').of(code) === undefined ? null : code;
}

/**
 * Countries that have shops, for the Shops country filter.
 *
 * Counts the shop pins (`shop: true`) per `countryCode`; a pin without a
 * country (the open sea, or an older api) counts only under All countries.
 * Names come from `Intl.DisplayNames` in the UI language and sort with that
 * language's collation. A selected code with no shop left is still listed
 * with a count of 0, so the filter shows what the page is filtered by.
 *
 * @param places - Pins from `GET /forum/messages/places`, or null while loading.
 * @param locale - UI language.
 * @param selected - Selected code, or null for All countries.
 * @returns Options sorted by name.
 */
export function shopCountryOptions(
  places: readonly ForumPlaceRow[] | null,
  locale: Locale,
  selected: string | null,
): ShopCountryOption[] {
  const counts = new Map<string, number>();
  for (const place of places ?? []) {
    const code = place.countryCode;
    if (place.shop === true && typeof code === 'string') {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  if (selected !== null && !counts.has(selected)) {
    counts.set(selected, 0);
  }
  const names = regionNames(locale);
  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      name: names.of(code) ?? code,
      count: places === null ? null : count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
