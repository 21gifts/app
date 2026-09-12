import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { LocaleProvider } from '@/components/LocaleProvider';
import { NumberFormatProvider } from '@/components/NumberFormatProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import type { Locale } from '@/lib/locale';
import { getCatalog } from '@/lib/messages';
import { DEFAULT_NUMBER_FORMAT, type NumberFormatStyle } from '@/lib/number-format';

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
 * Renders `ui` inside {@link LocaleProvider}, {@link NumberFormatProvider},
 * and {@link ThemeProvider}.
 *
 * @param ui - Client tree under test.
 * @param locale - Locale whose catalog to inject (default `en`).
 * @param numberFormat - Grouping style (default Swiss `ch`).
 * @returns Testing Library render result.
 */
export function renderWithLocale(
  ui: ReactElement,
  locale: Locale = 'en',
  numberFormat: NumberFormatStyle = DEFAULT_NUMBER_FORMAT,
): RenderResult {
  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <LocaleProvider locale={locale} messages={getCatalog(locale)}>
        <NumberFormatProvider initial={numberFormat}>
          <ThemeProvider>{children}</ThemeProvider>
        </NumberFormatProvider>
      </LocaleProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
