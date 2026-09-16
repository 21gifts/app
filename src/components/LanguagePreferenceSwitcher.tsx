'use client';

import { useRouter } from 'next/navigation';
import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SegmentedControl } from '@/components/ui';
import { LOCALES, LOCALE_COOKIE, type Locale } from '@/lib/locale';

/**
 * Native-language label for a locale option (not routed through the catalog).
 *
 * @param locale - Supported locale.
 * @returns The option label in that language.
 */
function nativeLabel(locale: Locale): string {
  switch (locale) {
    case 'en':
      return 'English';
    case 'de':
      return 'Deutsch';
    case 'es':
      return 'Español';
    case 'fil':
      return 'Filipino';
  }
}

/**
 * Writes the locale cookie and refreshes when `next` differs from `current`.
 *
 * @param next - Locale the visitor chose.
 * @param current - Locale currently active in the tree.
 * @param refresh - App Router refresh callback.
 */
function persistLocale(next: Locale, current: Locale, refresh: () => void): void {
  if (next === current) {
    return;
  }
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  refresh();
}

/**
 * Profile identity-card section: language via SegmentedControl.
 *
 * Always visible on the signed-in Profile card. Not page chrome.
 * Writes the `locale` cookie and refreshes the App Router tree (same
 * persist as LanguageSwitcher).
 *
 * @returns The language settings section.
 */
export function LanguagePreferenceSwitcher(): ReactElement {
  const { locale, t } = useTranslations();
  const router = useRouter();

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('language.label')}
      </p>
      <SegmentedControl
        tone="neutral"
        value={locale}
        options={LOCALES.map((code) => ({
          value: code,
          label: nativeLabel(code),
        }))}
        onChange={(next) => {
          persistLocale(next, locale, () => {
            router.refresh();
          });
        }}
        ariaLabel={t('aria.language')}
      />
    </div>
  );
}
