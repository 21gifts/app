import { cookies, headers } from 'next/headers';
import {
  LOCALE_COOKIE,
  parseAcceptLanguage,
  parseSupportedLocale,
  type Locale,
} from '@/lib/locale';

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
  const headerStore = await headers();
  const fromPublicUrl = parseSupportedLocale(
    headerStore.get('x-21gifts-public-locale') ?? undefined,
  );
  if (fromPublicUrl !== null) {
    return fromPublicUrl;
  }
  const cookieStore = await cookies();
  const fromCookie = parseSupportedLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  if (fromCookie !== null) {
    return fromCookie;
  }
  return parseAcceptLanguage(headerStore.get('accept-language') ?? '');
}
