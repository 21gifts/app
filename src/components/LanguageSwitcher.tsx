'use client';

import { useRouter } from 'next/navigation';
import type { ChangeEvent, ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { LOCALES, LOCALE_COOKIE, type Locale } from '@/lib/locale';

/**
 * Returns `value` if it is exactly one of {@link LOCALES}; otherwise `null`.
 *
 * @param value - Raw `<select>` value.
 * @returns A supported locale, or null when invalid.
 */
function parseLocaleOption(value: string): Locale | null {
  for (const locale of LOCALES) {
    if (locale === value) {
      return locale;
    }
  }
  return null;
}

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
 * Native `<select>` that persists the visitor's language choice in a cookie and
 * refreshes the App Router tree so server components re-negotiate locale.
 *
 * @param props - Visual tone for marketing (`dark`) or login/donate (`light`).
 * @returns The language select element.
 */
export function LanguageSwitcher(props: { tone: 'dark' | 'light' }): ReactElement {
  const { tone } = props;
  const { locale, t } = useTranslations();
  const router = useRouter();

  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = parseLocaleOption(event.target.value);
    if (next === null) {
      return;
    }
    const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  };

  const toneClass =
    tone === 'dark'
      ? 'border-white/20 bg-transparent text-white'
      : 'border-neutral-300 bg-transparent text-neutral-900';

  return (
    <select
      aria-label={t('language.label')}
      value={locale}
      onChange={onChange}
      className={`rounded-md border px-2 py-1 text-sm outline-none ${toneClass}`}
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {nativeLabel(code)}
        </option>
      ))}
    </select>
  );
}
