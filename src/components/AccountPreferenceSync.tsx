'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { setAccountFiat, setAccountLocale } from '@/lib/api';
import { LOCALE_COOKIE, type Locale } from '@/lib/locale';
import { fiatGeneration, localeGeneration } from '@/lib/preference-generation';
import { defaultFiatForLocale, FIAT_CODES, FIAT_COOKIE, type FiatCode } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

const syncedAccountIds = new Set<string>();

/**
 * Reads a raw preference cookie.
 *
 * @param name - Cookie name.
 * @returns Cookie value, or `undefined` when absent.
 */
function readPreferenceCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1];
}

/**
 * Writes the locale cookie using the shared preference attributes.
 *
 * @param locale - Locale to persist.
 */
function writeLocaleCookie(locale: Locale): void {
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/**
 * Returns a raw cookie only when it is an exact supported fiat code.
 *
 * @param value - Raw fiat cookie value.
 * @returns Supported fiat code, or `null`.
 */
function supportedFiat(value: string | undefined): FiatCode | null {
  for (const code of FIAT_CODES) {
    if (code === value) {
      return code;
    }
  }
  return null;
}

/**
 * Reconciles signed-in language and currency preferences with the account.
 * Missing account keys are left alone for compatibility with older api
 * responses. Each account id runs at most once for this page lifetime.
 *
 * @returns `null`.
 */
export function AccountPreferenceSync(): null {
  const { ready } = useHydrateSession();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const { locale: screenLocale } = useTranslations();
  const { fiat, setFiat } = useFiatPreference();
  const router = useRouter();

  useEffect(() => {
    if (!ready || session === null || account === null) {
      return;
    }
    if (syncedAccountIds.has(account.id)) {
      return;
    }
    syncedAccountIds.add(account.id);

    const localeAtRunStart = localeGeneration();
    const fiatAtRunStart = fiatGeneration();

    void (async (): Promise<void> => {
      await Promise.resolve();
      let effectiveLocale = screenLocale;

      if (account.locale === null) {
        const generation = localeGeneration();
        try {
          const updated = await setAccountLocale(session, screenLocale, true);
          if (localeGeneration() === generation) {
            setAccount(updated);
            if (typeof updated.locale === 'string') {
              effectiveLocale = updated.locale;
              if (readPreferenceCookie(LOCALE_COOKIE) !== updated.locale) {
                writeLocaleCookie(updated.locale);
                router.refresh();
              }
            }
          }
        } catch {
          // Preference hydration is best-effort; explicit controls surface by not changing.
        }
      } else if (typeof account.locale === 'string') {
        effectiveLocale = account.locale;
        if (
          localeGeneration() === localeAtRunStart &&
          readPreferenceCookie(LOCALE_COOKIE) !== account.locale
        ) {
          writeLocaleCookie(account.locale);
          router.refresh();
        }
      }

      if (account.fiat === null) {
        const nextFiat =
          supportedFiat(readPreferenceCookie(FIAT_COOKIE)) ?? defaultFiatForLocale(effectiveLocale);
        const generation = fiatGeneration();
        try {
          const updated = await setAccountFiat(session, nextFiat, true);
          if (fiatGeneration() !== generation) {
            return;
          }
          setAccount(updated);
          if (typeof updated.fiat === 'string' && updated.fiat !== fiat) {
            setFiat(updated.fiat);
          }
        } catch {
          // Preference hydration is best-effort; explicit controls surface by not changing.
        }
      } else if (
        typeof account.fiat === 'string' &&
        fiatGeneration() === fiatAtRunStart &&
        readPreferenceCookie(FIAT_COOKIE) !== account.fiat
      ) {
        setFiat(account.fiat);
      }
    })();
  }, [ready, session, account, setAccount, screenLocale, fiat, setFiat, router]);

  return null;
}
