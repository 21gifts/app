import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HappylandSection } from '@/components/HappylandSection';
import { getCatalog } from '@/lib/messages';

afterEach(cleanup);

describe('HappylandSection', () => {
  it.each(['en', 'de', 'es', 'fil'] as const)(
    'presents the original Happyland photographs in %s',
    (locale) => {
      const messages = getCatalog(locale);
      render(<HappylandSection locale={locale} />);
      const section = screen.getByRole('region', { name: messages['happyland.title'] });
      expect(section.id).toBe('happyland');
      expect(
        within(section).getByRole('img', { name: messages['happyland.photoAlt'] }),
      ).toBeTruthy();
      expect(within(section).getByText(messages['happyland.photoCaption'])).toBeTruthy();
      for (const key of ['street', 'home', 'household'] as const) {
        expect(
          within(section).getByRole('img', { name: messages[`happyland.${key}Alt`] }),
        ).toBeTruthy();
        expect(within(section).getByText(messages[`happyland.${key}Caption`])).toBeTruthy();
      }
      expect(within(section).getAllByRole('img')).toHaveLength(4);
      expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(3);
      for (const key of ['intro', 'daily', 'poverty', 'lanes', 'source'] as const) {
        expect(within(section).getByText(messages[`happyland.${key}`])).toBeTruthy();
      }
      expect(within(section).getAllByRole('article')).toHaveLength(3);
    },
  );
});
