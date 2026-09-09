import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumTodayGifts } from '@/components/ForumTodayGifts';
import type { GiftDay } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

const DAY: GiftDay = {
  day: '2026-09-09',
  giftCount: 2,
  totalSats: 4000,
  totalBtc: '0.00004000',
  totalUsd: '4.00',
  gifts: [
    {
      paidAt: '2026-09-09T10:00:00.000Z',
      amountSats: 3000,
      amountBtc: '0.00003000',
      amountUsd: '3.00',
      recipient: 'alice',
    },
    {
      paidAt: '2026-09-09T11:00:00.000Z',
      amountSats: 1000,
      amountBtc: '0.00001000',
      amountUsd: '1.00',
      recipient: 'bob',
    },
  ],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

describe('ForumTodayGifts', () => {
  it('shows the collapsed summary and expands to recipients plus day link', () => {
    renderWithLocale(<ForumTodayGifts day={DAY} />);
    expect(screen.getByText('Today 2 gifts · $4.00')).toBeTruthy();
    expect(screen.queryByText('alice · $3.00')).toBeNull();
    expect(screen.queryByText('Show today’s gifts')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show today’s gifts' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Hide today’s gifts' })).toBeTruthy();
    expect(screen.getByText('alice · $3.00')).toBeTruthy();
    expect(screen.getByText('bob · $1.00')).toBeTruthy();
    const dayLink = screen.getByRole('link', { name: 'All gifts this day' });
    expect(dayLink.getAttribute('href')).toBe('/stats/2026-09-09');
  });

  it('keeps the summary when giftCount is positive but gifts is empty', () => {
    renderWithLocale(
      <ForumTodayGifts
        day={{
          ...DAY,
          giftCount: 1,
          totalUsd: '3.00',
          gifts: [],
        }}
      />,
    );
    expect(screen.getByText('Today 1 gifts · $3.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show today’s gifts' }));
    expect(screen.queryByText('alice · $3.00')).toBeNull();
    expect(screen.getByRole('link', { name: 'All gifts this day' }).getAttribute('href')).toBe(
      '/stats/2026-09-09',
    );
  });
});
