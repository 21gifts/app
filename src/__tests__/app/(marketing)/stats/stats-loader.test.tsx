import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatsLoader } from '@/app/(marketing)/stats/stats-loader';
import type { GiftStats, WalletStats } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const EMPTY: GiftStats = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  totalChf: '0.00',
  totalEur: '0.00',
  totalPhp: '0.00',
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
    quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
  },
};

const WALLETS: WalletStats = {
  walletCount: 61,
  fundedWalletCount: 32,
  totalSats: 89096,
  totalBtc: '0.00089096',
  asOf: '2026-11-10T06:21:04.985Z',
  balanceOverTime: [
    {
      day: '2026-11-09',
      totalSats: 80000,
      totalBtc: '0.00080000',
      walletCount: 55,
      fundedWalletCount: 30,
    },
    {
      day: '2026-11-10',
      totalSats: 89096,
      totalBtc: '0.00089096',
      walletCount: 61,
      fundedWalletCount: 32,
    },
  ],
};

vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn(),
  fetchPostStats: vi.fn().mockResolvedValue({ postCount: 0, postsOverTime: [] }),
  fetchWalletStats: vi.fn().mockResolvedValue({
    walletCount: 0,
    fundedWalletCount: 0,
    totalSats: 0,
    totalBtc: '0.00000000',
    asOf: null,
    balanceOverTime: [],
  }),
}));

vi.mock('@/hooks/useSpotRate', () => ({
  useSpotRate: (): null => null,
}));

import { fetchGiftStats, fetchPostStats, fetchWalletStats } from '@/lib/api';

const fetchMock = vi.mocked(fetchGiftStats);
const fetchPostsMock = vi.mocked(fetchPostStats);
const fetchWalletsMock = vi.mocked(fetchWalletStats);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  fetchPostsMock.mockReset();
  fetchPostsMock.mockResolvedValue({ postCount: 0, postsOverTime: [] });
  fetchWalletsMock.mockReset();
  fetchWalletsMock.mockResolvedValue({
    walletCount: 0,
    fundedWalletCount: 0,
    totalSats: 0,
    totalBtc: '0.00000000',
    asOf: null,
    balanceOverTime: [],
  });
});

describe('StatsLoader', () => {
  it('renders loaded stats', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByText('No donations recorded yet.')).toBeTruthy();
    });
  });

  it('omits posts when that fetch fails and still shows gifts', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    fetchPostsMock.mockRejectedValueOnce(new Error('Could not load post stats. Please try again.'));
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByText('No donations recorded yet.')).toBeTruthy();
    });
    expect(screen.queryByRole('region', { name: 'Posts' })).toBeNull();
  });

  it('renders wallet totals and omits wallets when that fetch fails', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    fetchWalletsMock.mockResolvedValueOnce(WALLETS);
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Wallets' })).toBeTruthy();
    });
    expect(screen.getByRole('region', { name: 'Wallets' }).textContent).toContain("₿89'096");

    cleanup();
    fetchMock.mockResolvedValue(EMPTY);
    fetchWalletsMock.mockRejectedValueOnce(
      new Error('Could not load wallet stats. Please try again.'),
    );
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByText('No donations recorded yet.')).toBeTruthy();
    });
    expect(screen.queryByRole('region', { name: 'Wallets' })).toBeNull();
  });

  it('shows a fetch error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Could not load donation stats. Please try again.'));
    fetchMock.mockResolvedValueOnce(EMPTY);
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('No donations recorded yet.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the fallback error copy for a non-Error rejection', async () => {
    fetchMock.mockRejectedValueOnce('nope');
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load donation stats. Please try again.')).toBeTruthy();
    });
  });

  it('ignores a stale fetch after unmount', async () => {
    let resolveStale: ((value: GiftStats) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    const view = renderWithLocale(<StatsLoader />);
    view.unmount();
    resolveStale?.(EMPTY);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('ignores a stale rejection after unmount', async () => {
    let rejectStale: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectStale = reject;
        }),
    );
    const view = renderWithLocale(<StatsLoader />);
    view.unmount();
    rejectStale?.(new Error('gone'));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });
});
