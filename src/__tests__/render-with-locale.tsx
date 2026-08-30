import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LocaleProvider } from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import type { Locale } from '@/lib/locale';
import { getCatalog } from '@/lib/messages';

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

/**
 * Renders `ui` inside {@link LocaleProvider} and {@link ThemeProvider}.
 *
 * @param ui - Client tree under test.
 * @param locale - Locale whose catalog to inject (default `en`).
 * @returns Testing Library render result.
 */
export function renderWithLocale(ui: ReactElement, locale: Locale = 'en'): RenderResult {
  return render(
    <LocaleProvider locale={locale} messages={getCatalog(locale)}>
      <ThemeProvider>{ui}</ThemeProvider>
    </LocaleProvider>,
  );
}
