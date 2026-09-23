import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HappylandSection } from '@/components/HappylandSection';
import { getCatalog } from '@/lib/messages';
import { happylandPhotos } from '@/lib/happyland';

afterEach(cleanup);

describe('HappylandSection', () => {
  it.each(['en', 'de', 'es', 'fil'] as const)('presents the complete essay in %s', (locale) => {
    const messages = getCatalog(locale);
    render(<HappylandSection locale={locale} />);
    const section = screen.getByRole('region', { name: messages['happyland.title'] });
    expect(section.id).toBe('happyland');
    expect(within(section).getAllByRole('img')).toHaveLength(8);
    expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(2);
    for (const key of ['intro', 'daily', 'observation', 'poverty', 'lanes'] as const) {
      expect(within(section).getByText(messages[`happyland.${key}`])).toBeTruthy();
    }
    for (const photo of happylandPhotos) {
      const image = within(section).getByAltText(messages[photo.altKey]);
      expect(image.getAttribute('src')).toBe(photo.src);
      expect(image.closest('figure')?.querySelector('figcaption')?.textContent).toBe(
        messages[photo.captionKey],
      );
    }
    expect(within(section).getByText('Pagpag')).toBeTruthy();
  });
});
