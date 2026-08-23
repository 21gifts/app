'use client';

import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import type { Locale } from '@/lib/locale';
import type { MessageKey, Messages } from '@/lib/messages';
import { translate } from '@/lib/translate';

/** Value exposed by {@link LocaleProvider} / {@link useTranslations}. */
export interface LocaleContextValue {
  /** Active UI locale for this request/tree. */
  locale: Locale;
  /**
   * Look up and interpolate a catalog key.
   *
   * @param key - Catalog key.
   * @param vars - Placeholder values for `{name}` tokens.
   * @returns The interpolated string.
   * @throws If the key or a placeholder is missing.
   */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Provides the negotiated locale and a bound `t` helper to client components.
 *
 * @param props - Locale, messages for that locale, and children.
 * @returns Provider element wrapping `children`.
 */
export function LocaleProvider(props: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}): ReactElement {
  const { locale, messages, children } = props;
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: (key: MessageKey, vars?: Record<string, string | number>): string => {
        if (vars === undefined) {
          return translate(messages, key);
        }
        return translate(messages, key, vars);
      },
    }),
    [locale, messages],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Reads the active locale and `t` from the nearest {@link LocaleProvider}.
 *
 * @returns Locale and translate helper.
 * @throws If used outside {@link LocaleProvider}.
 */
export function useTranslations(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context === null) {
    throw new Error('useTranslations must be used within LocaleProvider');
  }
  return context;
}
