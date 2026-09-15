import { cookies } from 'next/headers';
import { type Locale } from '@/lib/locale';
import { defaultFiatForLocale, FIAT_COOKIE, parseFiatCode, type FiatCode } from '@/lib/stats-money';

/**
 * Cookie `fiat` if it is a supported code; otherwise {@link defaultFiatForLocale}.
 * Never writes a cookie.
 *
 * Lives in its own module so client components can import {@link FIAT_CODES}
 * from `@/lib/stats-money` without pulling `next/headers` into the browser
 * bundle.
 *
 * @param locale - Request UI locale (for the no-cookie default).
 * @returns The preferred fiat for this request.
 */
export async function getRequestFiat(locale: Locale): Promise<FiatCode> {
  const cookieStore = await cookies();
  return parseFiatCode(cookieStore.get(FIAT_COOKIE)?.value, defaultFiatForLocale(locale));
}
