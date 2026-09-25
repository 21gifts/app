'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { setAccountFiat, setAccountLocale } from '@/lib/api';
import type { Account } from '@/lib/api-types';
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
 * Returns the signed-in account when it is still the one this sync started for.
 *
 * @param accountId - Account id captured when the sync began.
 * @returns That account, or `null` after logout or a different sign-in.
 */
function signedInAccount(accountId: string): Account | null {
  const current = useAuthStore.getState();
  if (current.session === null || current.account === null || current.account.id !== accountId) {
    return null;
  }
  return current.account;
}

/**
 * Writes one hydrated preference onto the account that is current now.
 *
 * @param updated - Owner account returned by the preference route.
 * @param field - Preference this response is allowed to write.
 * @returns Whether the signed-in account is still the one that was synced.
 */
function rememberField(updated: Account, field: 'locale' | 'fiat'): boolean {
  const current = signedInAccount(updated.id);
  if (current === null) {
    return false;
  }
  if (current[field] !== updated[field]) {
    useAuthStore.getState().setAccount({ ...current, [field]: updated[field] });
  }
  return true;
}

/**
 * Reconciles signed-in language and currency preferences with the account.
 * Missing account keys are left alone for compatibility with older api
 * responses. Each account id runs at most once for this page lifetime.
 * The generation baseline is captured once while signed out and again on
 * logout. Later signed-out renders do not move it. A late response merges
 * only its own field and stops if the session is gone.
 *
 * @returns `null`.
 */
export function AccountPreferenceSync(): null {
  const { ready } = useHydrateSession();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const { locale: screenLocale } = useTranslations();
  const { fiat, setFiat } = useFiatPreference();
  const router = useRouter();
  const localeBaseline = useRef<number | null>(null);
  const fiatBaseline = useRef<number | null>(null);
  const sawSession = useRef(false);

  useEffect(() => {
    if (session === null) {
      syncedAccountIds.clear();
      if (sawSession.current || localeBaseline.current === null) {
        localeBaseline.current = localeGeneration();
        fiatBaseline.current = fiatGeneration();
      }
      sawSession.current = false;
      return;
    }
    sawSession.current = true;
    if (localeBaseline.current === null) {
      localeBaseline.current = localeGeneration();
    }
    if (fiatBaseline.current === null) {
      fiatBaseline.current = fiatGeneration();
    }
    if (!ready || account === null) {
      return;
    }
    if (syncedAccountIds.has(account.id)) {
      return;
    }
    syncedAccountIds.add(account.id);

    const localeAtRunStart = localeBaseline.current;
    const fiatAtRunStart = fiatBaseline.current;

    void (async (): Promise<void> => {
      await Promise.resolve();
      if (signedInAccount(account.id) === null) {
        return;
      }
      let effectiveLocale = screenLocale;

      if (account.locale === null && localeGeneration() === localeAtRunStart) {
        try {
          const updated = await setAccountLocale(session, screenLocale, true);
          if (signedInAccount(account.id) === null) {
            return;
          }
          if (localeGeneration() === localeAtRunStart) {
            if (!rememberField(updated, 'locale')) {
              return;
            }
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

      if (signedInAccount(account.id) === null) {
        return;
      }
      if (account.fiat === null && fiatGeneration() === fiatAtRunStart) {
        const nextFiat =
          supportedFiat(readPreferenceCookie(FIAT_COOKIE)) ?? defaultFiatForLocale(effectiveLocale);
        try {
          const updated = await setAccountFiat(session, nextFiat, true);
          if (signedInAccount(account.id) === null || fiatGeneration() !== fiatAtRunStart) {
            return;
          }
          if (!rememberField(updated, 'fiat')) {
            return;
          }
          if (
            typeof updated.fiat === 'string' &&
            readPreferenceCookie(FIAT_COOKIE) !== updated.fiat
          ) {
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
  }, [ready, session, account, screenLocale, fiat, setFiat, router]);

  return null;
}
