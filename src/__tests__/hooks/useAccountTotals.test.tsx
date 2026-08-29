import { act, cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import type { GiftStats } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn(),
}));

import { fetchGiftStats } from '@/lib/api';

const fetchMock = vi.mocked(fetchGiftStats);

const STATS: GiftStats = {
  totalSats: 1000,
  totalBtc: '0.00001000',
  totalUsd: '0.95',
  giftCount: 2,
  recipientCount: 1,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [{ recipient: 'alice', giftCount: 2, sats: 1000, btc: '0.00001000', usd: '0.95' }],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

/** Mounts {@link useAccountTotals} for assertions. */
function Probe(): ReactElement {
  const { donatedSats, receivedSats, loading } = useAccountTotals();
  return (
    <p>
      {loading ? 'loading' : 'ready'}:{donatedSats}:{receivedSats}
    </p>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
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

describe('useAccountTotals', () => {
  it('treats a missing account as a null address', async () => {
    fetchMock.mockResolvedValue(STATS);
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:0')).toBeTruthy();
    });
  });

  it('maps the alice byRecipient row on success', async () => {
    fetchMock.mockResolvedValue(STATS);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000')).toBeTruthy();
    });
  });

  it('resolves to zeros on error', async () => {
    fetchMock.mockRejectedValue(new Error('Could not load gift stats. Please try again.'));
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:0')).toBeTruthy();
    });
  });

  it('reports loading while the fetch is in flight', async () => {
    let resolve!: (value: GiftStats) => void;
    fetchMock.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0')).toBeTruthy();
    await act(async () => {
      resolve(STATS);
    });
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000')).toBeTruthy();
    });
  });

  it('drops a stale result when the lightning address changes mid-flight', async () => {
    let resolveFirst!: (value: GiftStats) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce({
      ...STATS,
      byRecipient: [{ recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' }],
    });

    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0')).toBeTruthy();

    await act(async () => {
      useAuthStore.setState({
        session: 'tok',
        account: {
          id: 'acc_1',
          linkingKey: null,
          role: 'basis',
          name: 'Ada',
          lightningAddress: 'bob@walletofsatoshi.com',
          lightningAddressVerified: false,
          forumLawsDismissed: false,
          createdAt: 1,
        },
      });
    });

    await act(async () => {
      resolveFirst(STATS);
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500')).toBeTruthy();
    });
  });

  it('drops a stale rejection when the lightning address changes mid-flight', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    fetchMock.mockResolvedValueOnce({
      ...STATS,
      byRecipient: [{ recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' }],
    });

    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0')).toBeTruthy();

    await act(async () => {
      useAuthStore.setState({
        session: 'tok',
        account: {
          id: 'acc_1',
          linkingKey: null,
          role: 'basis',
          name: 'Ada',
          lightningAddress: 'bob@walletofsatoshi.com',
          lightningAddressVerified: false,
          forumLawsDismissed: false,
          createdAt: 1,
        },
      });
    });

    await act(async () => {
      rejectFirst(new Error('fail'));
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500')).toBeTruthy();
    });
  });
});
