import type { Locale } from '@/lib/locale';
import descriptionsByLocale from '@/lib/screen-variant-descriptions-locale.json';

/**
 * Screen-card description for one catalog id in the request locale.
 *
 * @param locale - UI locale.
 * @param id - Catalog id (`<path>:<variant>`).
 * @param english - English paragraph from the screens handbook, when present.
 * @param fallbackLabel - Catalog label used when English is missing or blank.
 * @returns Locale text, unchanged English, or `fallbackLabel`.
 * @throws When `de`, `es`, or `fil` has no non-blank text for `id`.
 */
export function screenVariantDescription(
  locale: Locale,
  id: string,
  english: string | undefined,
  fallbackLabel: string,
): string {
  if (english === undefined || english.trim() === '') {
    return fallbackLabel;
  }
  if (locale === 'en') {
    return english;
  }
  if (!Object.prototype.hasOwnProperty.call(descriptionsByLocale, id)) {
    throw new Error(`Missing ${locale} screen description for ${id}`);
  }
  const copy = descriptionsByLocale[id as keyof typeof descriptionsByLocale];
  if (copy === undefined) {
    throw new Error(`Missing ${locale} screen description for ${id}`);
  }
  const text = locale === 'de' ? copy.de : locale === 'es' ? copy.es : copy.fil;
  if (text.trim() === '') {
    throw new Error(`Missing ${locale} screen description for ${id}`);
  }
  return text;
}
