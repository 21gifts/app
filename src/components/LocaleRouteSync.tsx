'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import type { Locale } from '@/lib/locale';
import { readLocaleCookie, writeLocaleCookie } from '@/lib/locale-cookie';
import { parseLocalizedPublicPath } from '@/lib/public-locale-path';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Last path and expected language that already called refresh.
 * `null` before the first refresh and again once that language matches the provider.
 */
type RefreshKey = { current: string | null };

/**
 * Aligns the locale cookie and a stale layout with the path that is showing.
 *
 * A language URL is written to the cookie when it differs and the account has
 * no saved language. A path without a language prefix writes the saved account
 * language into the cookie when that cookie differs, before anything else.
 * The language the server should render is the URL language,
 * otherwise the saved account language, otherwise the cookie. When that differs
 * from the surrounding provider, refresh runs once for that path and language.
 * The guard stays only while they still differ, so the refresh does not loop.
 * When the expected language matches the provider, the guard is cleared. When
 * no language is known, the guard is left unchanged.
 *
 * @param path - Path of the page that is actually showing.
 * @param rendered - Locale from the surrounding provider.
 * @param refresh - App Router refresh callback.
 * @param refreshedKey - Guard against a second refresh while the same path and
 * language still differ. Cleared when they match.
 */
function syncRouteLocale(
  path: string,
  rendered: Locale,
  refresh: () => void,
  refreshedKey: RefreshKey,
): void {
  const localized = parseLocalizedPublicPath(path);
  const accountLocale = useAuthStore.getState().account?.locale;
  const saved = typeof accountLocale === 'string' ? accountLocale : null;

  if (localized === null && saved !== null && readLocaleCookie() !== saved) {
    writeLocaleCookie(saved);
  }

  if (localized !== null && saved === null && readLocaleCookie() !== localized.locale) {
    writeLocaleCookie(localized.locale);
  }

  let expected: Locale | null;
  if (localized !== null) {
    expected = localized.locale;
  } else if (saved !== null) {
    expected = saved;
  } else {
    expected = readLocaleCookie();
  }
  if (expected === null) {
    return;
  }
  if (expected === rendered) {
    refreshedKey.current = null;
    return;
  }
  const key = `${path}\0${expected}`;
  if (refreshedKey.current === key) {
    return;
  }
  refreshedKey.current = key;
  refresh();
}

/**
 * Keeps the root layout on the language of the current path.
 *
 * Mounted once under the root provider. Renders nothing. Client navigations
 * do not re-render the root layout, so a mismatch refreshes it.
 *
 * @returns `null`.
 */
export function LocaleRouteSync(): null {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useTranslations();
  const localeRef = useRef(locale);
  const refreshRef = useRef(router.refresh);
  /** Path and language of the last refresh. Cleared once the provider shows that language. */
  const refreshedKey = useRef<string | null>(null);
  localeRef.current = locale;
  refreshRef.current = router.refresh;

  useEffect(() => {
    syncRouteLocale(
      pathname,
      locale,
      () => {
        refreshRef.current();
      },
      refreshedKey,
    );
  }, [pathname, locale]);

  useEffect(() => {
    const onPageShow = (event: Event): void => {
      if (!(event instanceof PageTransitionEvent) || !event.persisted) {
        return;
      }
      syncRouteLocale(
        globalThis.location.pathname,
        localeRef.current,
        () => {
          refreshRef.current();
        },
        refreshedKey,
      );
    };
    globalThis.addEventListener('pageshow', onPageShow);
    return () => {
      globalThis.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  return null;
}
