import { LOCALES, type Locale } from '@/lib/locale';

/** Public pages with complete copy in every supported language. */
export type LocalizedPublicPath = '/' | '/about' | '/donate' | '/rules';

/** A stable URL path for one public page and language. */
export function localizedPublicPath(locale: Locale, path: LocalizedPublicPath): string {
  return `/${locale}${path === '/' ? '' : path}`;
}

/** Resolve a localized public URL without accepting other app routes. */
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

/** Preserve the current public page when the visitor switches languages. */
export function publicPathFromUrl(pathname: string): LocalizedPublicPath | null {
  const localized = parseLocalizedPublicPath(pathname);
  if (localized !== null) return localized.path;
  for (const path of ['/', '/about', '/donate', '/rules'] as const) {
    if (pathname === path) return path;
  }
  return null;
}
