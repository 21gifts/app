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
 * The codes the api gives a pin: the 249 assigned ISO 3166-1 alpha-2 codes
 * plus `XK` (Kosovo). A shared link with any other code (a grouping such as
 * `EU`, an alias such as `UK`, or a withdrawn code such as `YU`) shows all
 * countries.
 */
const COUNTRY_CODES: ReadonlySet<string> = new Set(
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS
   BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE
   EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM
   HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC
   LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA
   NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
   SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO
   TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK`.split(/\s+/),
);

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
 * Two letters in any case that are a code the api gives a pin (ISO 3166-1
 * alpha-2 or `XK`). Anything else (missing, blank, longer, digits, an
 * unassigned or withdrawn code, an alias, or a grouping) is no country, so
 * the page shows all countries.
 *
 * @param raw - `URLSearchParams.get('country')`.
 * @returns The upper-case code, or null for All countries.
 */
export function shopCountryFromQuery(raw: string | null): string | null {
  if (raw === null || !/^[A-Za-z]{2}$/.test(raw)) {
    return null;
  }
  const code = raw.toUpperCase();
  return COUNTRY_CODES.has(code) ? code : null;
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
