import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from '@/components/ProfileScreen';
import { fetchGiftStats } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn().mockResolvedValue({
    totalSats: 0,
    totalBtc: '0.00000000',
    totalUsd: '0.00',
    giftCount: 0,
    recipientCount: 0,
    firstPaidAt: null,
    lastPaidAt: null,
    spendOverTime: [],
    byRecipient: [],
    byMonth: [],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
    },
  }),
  setName: vi.fn(),
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
}));

const EMPTY_FX = {
  quote: 'BTC-USD' as const,
  dayBasis: 'utc' as const,
  source: 'coinbase-exchange-daily-close' as const,
};

beforeEach(() => {
  vi.mocked(fetchGiftStats).mockReset();
  vi.mocked(fetchGiftStats).mockResolvedValue({
    totalSats: 0,
    totalBtc: '0.00000000',
    totalUsd: '0.00',
    giftCount: 0,
    recipientCount: 0,
    firstPaidAt: null,
    lastPaidAt: null,
    spendOverTime: [],
    byRecipient: [],
    byMonth: [],
    fx: EMPTY_FX,
  });
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('ProfileScreen', () => {
  it('shows the heading, back link, name form, and address form', async () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.queryByText('Back to forum')).toBeNull();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Wallet of Satoshi address')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Given 0 sats')).toBeTruthy();
    });
  });

  it('keeps totals as amounts and shows the chart heading while fetch is pending', () => {
    vi.mocked(fetchGiftStats).mockReturnValue(new Promise<GiftStats>(() => undefined));
    renderWithLocale(<ProfileScreen />);
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByLabelText('Given 0 sats')).toBeTruthy();
    expect(screen.getByLabelText('Received 0 sats')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Given and received' })).toBeTruthy();
  });

  it('formats a single received sat with forum.satsOne', async () => {
    vi.mocked(fetchGiftStats).mockResolvedValue({
      totalSats: 0,
      totalBtc: '0.00000000',
      totalUsd: '0.00',
      giftCount: 0,
      recipientCount: 0,
      firstPaidAt: null,
      lastPaidAt: null,
      spendOverTime: [],
      byRecipient: [
        {
          recipient: 'alice',
          giftCount: 1,
          sats: 1,
          btc: '0.00000001',
          usd: '0.00',
        },
      ],
      byMonth: [],
      fx: EMPTY_FX,
    });
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByLabelText('Received 1 sat')).toBeTruthy();
    });
  });

  it('shows a series day tick after filtered stats load', async () => {
    const seriesStats: GiftStats = {
      totalSats: 1500,
      totalBtc: '0.00001500',
      totalUsd: '1.43',
      giftCount: 2,
      recipientCount: 1,
      firstPaidAt: '2026-06-01T00:00:00.000Z',
      lastPaidAt: '2026-06-03T00:00:00.000Z',
      spendOverTime: [
        {
          day: '2026-06-01',
          sats: 500,
          cumulativeSats: 500,
          btc: '0.00000500',
          cumulativeBtc: '0.00000500',
          usd: '0.48',
          cumulativeUsd: '0.48',
        },
        {
          day: '2026-06-02',
          sats: 0,
          cumulativeSats: 500,
          btc: '0.00000000',
          cumulativeBtc: '0.00000500',
          usd: '0.00',
          cumulativeUsd: '0.48',
        },
        {
          day: '2026-06-03',
          sats: 1000,
          cumulativeSats: 1500,
          btc: '0.00001000',
          cumulativeBtc: '0.00001500',
          usd: '0.95',
          cumulativeUsd: '1.43',
        },
      ],
      byRecipient: [
        { recipient: 'alice', giftCount: 2, sats: 1500, btc: '0.00001500', usd: '1.43' },
      ],
      byMonth: [],
      fx: EMPTY_FX,
    };
    vi.mocked(fetchGiftStats).mockResolvedValue(seriesStats);
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('2026-06-01')).toBeTruthy();
    });
    expect(screen.getByLabelText('Received 1500 sats')).toBeTruthy();
  });
});
