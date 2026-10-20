import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TermsPage, { metadata } from '@/app/(marketing)/terms/page';
import type { Locale } from '@/lib/locale';
import { getCatalog, type MessageKey } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

const CLAUSES = [1, 2, 3, 4, 5] as const;

describe('TermsPage', () => {
  it('has English document metadata', () => {
    expect(metadata.title).toBe('Terms of Use — 21.gifts');
  });

  it('renders the English title, date, section heading, and five numbered clauses', async () => {
    render(await TermsPage());
    expect(screen.getByRole('heading', { name: 'Terms of Use', level: 1 })).toBeTruthy();
    expect(screen.getByText('Last updated: 6 October 2026')).toBeTruthy();
    const section = screen.getByRole('heading', { name: 'Wallet and data', level: 2 });
    expect(section.id).toBe('wallet-and-data');
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]?.textContent).toBe(
      'Self-custody. Your bitcoin is held only in your own wallet and stays under your sole control. 21.gifts does not hold any funds, cannot spend your balance and cannot make payments on your behalf.',
    );
    expect(items[4]?.textContent).toContain('an assessment of your creditworthiness.');
  });

  it.each<Locale>(['en', 'de', 'es', 'fil'])(
    'renders every clause from the %s catalog in order',
    async (locale) => {
      vi.mocked(getRequestLocale).mockResolvedValueOnce(locale);
      const catalog = getCatalog(locale);
      render(await TermsPage());
      expect(screen.getByRole('heading', { name: catalog['terms.title'], level: 1 })).toBeTruthy();
      expect(screen.getByText(catalog['terms.lastUpdated'])).toBeTruthy();
      expect(
        screen.getByRole('heading', { name: catalog['terms.heading'], level: 2 }),
      ).toBeTruthy();
      const items = within(screen.getByRole('list')).getAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual(
        CLAUSES.map(
          (n) =>
            `${catalog[`terms.clause${n}Title` as MessageKey]}. ${catalog[`terms.clause${n}` as MessageKey]}`,
        ),
      );
    },
  );
});
