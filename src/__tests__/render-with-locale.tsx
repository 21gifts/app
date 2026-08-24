import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LocaleProvider } from '@/components/LocaleProvider';
import type { Locale } from '@/lib/locale';
import { getCatalog } from '@/lib/messages';

/**
 * Renders `ui` inside {@link LocaleProvider} with the given catalog.
 *
 * @param ui - Client tree under test.
 * @param locale - Locale whose catalog to inject (default `en`).
 * @returns Testing Library render result.
 */
export function renderWithLocale(ui: ReactElement, locale: Locale = 'en'): RenderResult {
  return render(
    <LocaleProvider locale={locale} messages={getCatalog(locale)}>
      {ui}
    </LocaleProvider>,
  );
}
