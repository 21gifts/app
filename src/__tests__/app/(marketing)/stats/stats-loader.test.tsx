import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatsLoader } from '@/app/(marketing)/stats/stats-loader';
import type { GiftStats } from '@/lib/api-types';
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

vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn(),
}));

import { fetchGiftStats } from '@/lib/api';

const fetchMock = vi.mocked(fetchGiftStats);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe('StatsLoader', () => {
  it('renders loaded stats', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByText('No gifts recorded yet.')).toBeTruthy();
    });
  });

  it('shows a fetch error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Could not load gift stats. Please try again.'));
    fetchMock.mockResolvedValueOnce(EMPTY);
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('No gifts recorded yet.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the fallback error copy for a non-Error rejection', async () => {
    fetchMock.mockRejectedValueOnce('nope');
    renderWithLocale(<StatsLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load gift stats. Please try again.')).toBeTruthy();
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
