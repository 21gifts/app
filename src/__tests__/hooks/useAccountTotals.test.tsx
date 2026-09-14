import { act, cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import type { AccountActivity } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchAccountActivity: vi.fn(),
}));

import { fetchAccountActivity } from '@/lib/api';

const fetchMock = vi.mocked(fetchAccountActivity);

const EMPTY_FX = {
  quote: 'BTC-USD' as const,
  dayBasis: 'utc' as const,
  source: 'coinbase-exchange-daily-close' as const,
  quotes: [{ code: 'USD' as const, pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
};

const ACTIVITY: AccountActivity = {
  donatedSats: 2100,
  receivedSats: 1000,
  donatedOverTime: [
    {
      day: '2026-06-02',
      sats: 2100,
      cumulativeSats: 2100,
      btc: '0.00002100',
      cumulativeBtc: '0.00002100',
      usd: '2.00',
      cumulativeUsd: '2.00',
      chf: '2.00',
      eur: '2.00',
      php: '2.00',
      cumulativeChf: '2.00',
      cumulativeEur: '2.00',
      cumulativePhp: '2.00',
    },
  ],
  receivedOverTime: [
    {
      day: '2026-06-01',
      sats: 1000,
      cumulativeSats: 1000,
      btc: '0.00001000',
      cumulativeBtc: '0.00001000',
      usd: '0.95',
      cumulativeUsd: '0.95',
      chf: '0.80',
      eur: '0.86',
      php: '53.00',
      cumulativeChf: '0.80',
      cumulativeEur: '0.86',
      cumulativePhp: '53.00',
    },
  ],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
    quotes: [
      { code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' },
      { code: 'CHF', pair: 'USD-CHF', source: 'ecb-daily' },
      { code: 'EUR', pair: 'USD-EUR', source: 'ecb-daily' },
      { code: 'PHP', pair: 'USD-PHP', source: 'ecb-daily' },
    ],
  },
};

const OTHER_ACTIVITY: AccountActivity = {
  donatedSats: 0,
  receivedSats: 500,
  donatedOverTime: [],
  receivedOverTime: [],
  fx: EMPTY_FX,
};

/** Mounts {@link useAccountTotals} for assertions. */
function Probe(): ReactElement {
  const { donatedSats, receivedSats, donateOverTime, receiveOverTime, loading } =
    useAccountTotals();
  const state = loading ? 'loading' : 'ready';
  return (
    <p>{`${state}:${donatedSats}:${receivedSats}:${donateOverTime.length}:${receiveOverTime.length}`}</p>
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
      location: null,
      lightningAddress: 'alice@walletofsatoshi.com',
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: 1_700_000_001,
      viewKey: 'a'.repeat(64),
      aboutMe: null,
      setup: null,
      missing: [],
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('useAccountTotals', () => {
  it('treats a missing session as zeros and does not fetch', async () => {
    fetchMock.mockResolvedValue(ACTIVITY);
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:0:0:0')).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches activity when the Lightning Address is blank', async () => {
    fetchMock.mockResolvedValue(ACTIVITY);
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: '   ',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:2100:1000:1:1')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });

  it('fetches activity when the Lightning Address is null', async () => {
    fetchMock.mockResolvedValue(ACTIVITY);
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:2100:1000:1:1')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });

  it('sets both totals and both series from the activity payload', async () => {
    fetchMock.mockResolvedValue(ACTIVITY);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:2100:1000:1:1')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });

  it('resolves to zeros and empty series on error', async () => {
    fetchMock.mockRejectedValue(new Error('Could not load gift stats. Please try again.'));
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:0:0:0')).toBeTruthy();
    });
  });

  it('reports loading while the fetch is in flight', async () => {
    let resolve!: (value: AccountActivity) => void;
    fetchMock.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0:0:0')).toBeTruthy();
    await act(async () => {
      resolve(ACTIVITY);
    });
    await waitFor(() => {
      expect(screen.getByText('ready:2100:1000:1:1')).toBeTruthy();
    });
  });

  it('clears totals and series when switching session after a loaded result', async () => {
    fetchMock.mockResolvedValueOnce(ACTIVITY);
    let resolveOther!: (value: AccountActivity) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOther = resolve;
        }),
    );

    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:2100:1000:1:1')).toBeTruthy();
    });

    await act(async () => {
      useAuthStore.setState({ session: 'tok2' });
    });

    expect(screen.getByText('loading:0:0:0:0')).toBeTruthy();

    await act(async () => {
      resolveOther(OTHER_ACTIVITY);
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0:0')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok2');
  });

  it('refetches when the Lightning Address changes on the same session', async () => {
    fetchMock.mockResolvedValueOnce(ACTIVITY);
    fetchMock.mockResolvedValueOnce(OTHER_ACTIVITY);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:2100:1000:1:1')).toBeTruthy();
    });
    await act(async () => {
      useAuthStore.setState((state) => ({
        account:
          state.account === null
            ? null
            : { ...state.account, lightningAddress: 'bob@walletofsatoshi.com' },
      }));
    });
    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0:0')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a stale result when the session changes mid-flight', async () => {
    let resolveFirst!: (value: AccountActivity) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce(OTHER_ACTIVITY);

    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0:0:0')).toBeTruthy();

    await act(async () => {
      useAuthStore.setState({ session: 'tok2' });
    });

    await act(async () => {
      resolveFirst(ACTIVITY);
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0:0')).toBeTruthy();
    });
  });

  it('drops a stale rejection when the session changes mid-flight', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    fetchMock.mockResolvedValueOnce(OTHER_ACTIVITY);

    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0:0:0')).toBeTruthy();

    await act(async () => {
      useAuthStore.setState({ session: 'tok2' });
    });

    await act(async () => {
      rejectFirst(new Error('fail'));
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0:0')).toBeTruthy();
    });
  });

  it('clears totals when the session becomes null', async () => {
    fetchMock.mockResolvedValue(ACTIVITY);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:2100:1000:1:1')).toBeTruthy();
    });

    await act(async () => {
      useAuthStore.setState({ session: null });
    });

    expect(screen.getByText('ready:0:0:0:0')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
