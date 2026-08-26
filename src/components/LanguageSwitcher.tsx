'use client';

import { useRouter } from 'next/navigation';
import type { ChangeEvent, ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { LOCALES, LOCALE_COOKIE, parseSupportedLocale, type Locale } from '@/lib/locale';

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
 * @param props - Visual tone for marketing (`dark`) or login/donate (`light`),
 *   and optional `embedded` when the select is a segment of `SignedInChrome`.
 * @returns The language select element.
 */
export function LanguageSwitcher(props: {
  tone: 'dark' | 'light';
  embedded?: boolean;
}): ReactElement {
  const { tone, embedded = false } = props;
  const { locale, t } = useTranslations();
  const router = useRouter();

  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = parseSupportedLocale(event.target.value);
    if (next === null) {
      return;
    }
    const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  };

  const toneText = tone === 'dark' ? 'text-white' : 'text-neutral-900';
  const className = embedded
    ? `border-0 bg-transparent px-2 py-1 text-sm outline-none ${toneText}`
    : `rounded-md border px-2 py-1 text-sm outline-none ${
        tone === 'dark'
          ? 'border-white/20 bg-transparent text-white'
          : 'border-neutral-300 bg-transparent text-neutral-900'
      }`;

  return (
    <select
      aria-label={t('language.label')}
      value={locale}
      onChange={onChange}
      className={className}
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {nativeLabel(code)}
        </option>
      ))}
    </select>
  );
}
