import { LOCALE_COOKIE, parseSupportedLocale, type Locale } from '@/lib/locale';

/**
 * Writes the locale cookie for one year.
 *
 * `Path=/`, `Max-Age=31536000`, `SameSite=Lax`, and `Secure` when the page is https.
 *
 * @param locale - Supported locale to store.
 * @returns void
 */
export function writeLocaleCookie(locale: Locale): void {
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/**
 * Reads the supported locale stored in the locale cookie.
 *
 * @returns The cookie locale, or null when the cookie is missing or not supported.
 */
export function readLocaleCookie(): Locale | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return parseSupportedLocale(match?.[1]);
}
