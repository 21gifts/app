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
  spendOverTime: [
    {
      day: '2026-06-01',
      sats: 1000,
      cumulativeSats: 1000,
      btc: '0.00001000',
      cumulativeBtc: '0.00001000',
      usd: '0.95',
      cumulativeUsd: '0.95',
    },
  ],
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
  const { donatedSats, receivedSats, receiveOverTime, loading } = useAccountTotals();
  return (
    <p>
      {loading ? 'loading' : 'ready'}:{donatedSats}:{receivedSats}:{receiveOverTime.length}
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
      rulesAgreedAt: 1_700_000_001,
      viewKey: 'a'.repeat(64),
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('useAccountTotals', () => {
  it('treats a missing account as a null address and does not fetch', async () => {
    fetchMock.mockResolvedValue(STATS);
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:0:0')).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the fetch when the address is blank', async () => {
    fetchMock.mockResolvedValue(STATS);
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        lightningAddress: '   ',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
      },
    });
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:0:0')).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches filtered stats with the alice handle and plumbs receiveOverTime', async () => {
    fetchMock.mockResolvedValue(STATS);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000:1')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('alice');
  });

  it('trims surrounding whitespace on the store address before fetch and totals', async () => {
    fetchMock.mockResolvedValue(STATS);
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        lightningAddress: ' Alice@walletofsatoshi.com ',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
      },
    });
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000:1')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('Alice');
  });

  it('maps the alice byRecipient row on success', async () => {
    fetchMock.mockResolvedValue(STATS);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000:1')).toBeTruthy();
    });
  });

  it('resolves to zeros on error', async () => {
    fetchMock.mockRejectedValue(new Error('Could not load gift stats. Please try again.'));
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:0:0')).toBeTruthy();
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
    expect(screen.getByText('loading:0:0:0')).toBeTruthy();
    await act(async () => {
      resolve(STATS);
    });
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000:1')).toBeTruthy();
    });
  });

  it('clears totals and series when switching address after a loaded result', async () => {
    fetchMock.mockResolvedValueOnce(STATS);
    let resolveBob!: (value: GiftStats) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBob = resolve;
        }),
    );

    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000:1')).toBeTruthy();
    });

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
          rulesAgreedAt: null,
          viewKey: 'a'.repeat(64),
        },
      });
    });

    expect(screen.getByText('loading:0:0:0')).toBeTruthy();

    await act(async () => {
      resolveBob({
        ...STATS,
        spendOverTime: [],
        byRecipient: [
          { recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0')).toBeTruthy();
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
      spendOverTime: [],
      byRecipient: [{ recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' }],
    });

    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0:0')).toBeTruthy();

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
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
        },
      });
    });

    await act(async () => {
      resolveFirst(STATS);
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0')).toBeTruthy();
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
      spendOverTime: [],
      byRecipient: [{ recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' }],
    });

    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0:0')).toBeTruthy();

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
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
        },
      });
    });

    await act(async () => {
      rejectFirst(new Error('fail'));
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0')).toBeTruthy();
    });
  });
});
