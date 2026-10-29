import { LOCALES, type Locale } from '@/lib/locale';

/** Public pages with complete copy in every supported language. */
export type LocalizedPublicPath = '/' | '/about' | '/donate' | '/rules';

/**
 * Builds the stable URL for one public page in one language.
 *
 * @param locale - Supported UI locale.
 * @param path - Public page path (`/`, `/about`, `/donate`, or `/rules`).
 * @returns The language-prefixed path, such as `/de` or `/de/about`.
 */
export function localizedPublicPath(locale: Locale, path: LocalizedPublicPath): string {
  return `/${locale}${path === '/' ? '' : path}`;
}

/**
 * Resolves a language URL that is one of the public pages.
 *
 * @param pathname - Request pathname, such as `/de/about`.
 * @returns The locale and public page, or null when the path is not one of them.
 */
export function parseLocalizedPublicPath(
  pathname: string,
): { locale: Locale; path: LocalizedPublicPath } | null {
  for (const locale of LOCALES) {
    for (const path of ['/', '/about', '/donate', '/rules'] as const) {
      if (pathname === localizedPublicPath(locale, path)) {
        return { locale, path };
      }
    }
  }
  return null;
}

/**
 * Keeps the current public page when the visitor switches languages.
 *
 * @param pathname - A language URL or a legacy unprefixed public path.
 * @returns The public page path, or null when the pathname is not one of them.
 */
export function publicPathFromUrl(pathname: string): LocalizedPublicPath | null {
  const localized = parseLocalizedPublicPath(pathname);
  if (localized !== null) return localized.path;
  for (const path of ['/', '/about', '/donate', '/rules'] as const) {
    if (pathname === path) return path;
  }
  return null;
}
