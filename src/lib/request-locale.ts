import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, LOCALES, parseAcceptLanguage, type Locale } from '@/lib/locale';

/**
 * Returns `value` if it is exactly one of {@link LOCALES}; otherwise `null`.
 *
 * @param value - Raw cookie value, or undefined when absent.
 * @returns A supported locale, or null when invalid/missing.
 */
function parseLocaleValue(value: string | undefined): Locale | null {
  if (value === undefined) {
    return null;
  }
  for (const locale of LOCALES) {
    if (locale === value) {
      return locale;
    }
  }
  return null;
}

/**
 * Cookie `locale` if it is a supported locale; otherwise Accept-Language.
 * Never writes a cookie.
 *
 * Lives in its own module so client components can import {@link LOCALES}
 * from `@/lib/locale` without pulling `next/headers` into the browser bundle.
 *
 * @returns The locale for this request.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = parseLocaleValue(cookieStore.get(LOCALE_COOKIE)?.value);
  if (fromCookie !== null) {
    return fromCookie;
  }
  const headerStore = await headers();
  return parseAcceptLanguage(headerStore.get('accept-language') ?? '');
}
