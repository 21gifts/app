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

const ACTIVITY: AccountActivity = {
  donatedSats: 0,
  receivedSats: 1000,
  donatedOverTime: [],
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

/** Mounts {@link useAccountTotals} for assertions. */
function Probe(): ReactElement {
  const { donatedSats, receivedSats, donateOverTime, receiveOverTime, loading } =
    useAccountTotals();
  return (
    <p>
      {loading ? 'loading' : 'ready'}:{donatedSats}:{receivedSats}:{receiveOverTime.length}:
      {donateOverTime.length}
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
  it('does not fetch when there is no session', async () => {
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
      expect(screen.getByText('ready:0:1000:1:0')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });

  it('fetches /me/activity with the session and plumbs both series', async () => {
    fetchMock.mockResolvedValue({
      ...ACTIVITY,
      donatedSats: 200,
      donatedOverTime: [
        {
          day: '2026-06-02',
          sats: 200,
          cumulativeSats: 200,
          btc: '0.00000200',
          cumulativeBtc: '0.00000200',
          usd: '0.19',
          cumulativeUsd: '0.19',
          chf: '0.16',
          eur: '0.17',
          php: '11.00',
          cumulativeChf: '0.16',
          cumulativeEur: '0.17',
          cumulativePhp: '11.00',
        },
      ],
    });
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:200:1000:1:1')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });

  it('maps donatedSats and receivedSats from the activity payload', async () => {
    fetchMock.mockResolvedValue(ACTIVITY);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000:1:0')).toBeTruthy();
    });
  });

  it('resolves to zeros on error', async () => {
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
      expect(screen.getByText('ready:0:1000:1:0')).toBeTruthy();
    });
  });

  it('clears totals and series when switching session after a loaded result', async () => {
    fetchMock.mockResolvedValueOnce(ACTIVITY);
    let resolveBob!: (value: AccountActivity) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBob = resolve;
        }),
    );

    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000:1:0')).toBeTruthy();
    });

    await act(async () => {
      useAuthStore.setState({ session: 'tok-bob' });
    });

    expect(screen.getByText('loading:0:0:0:0')).toBeTruthy();

    await act(async () => {
      resolveBob({
        ...ACTIVITY,
        receivedSats: 500,
        receivedOverTime: [],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0:0')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenLastCalledWith('tok-bob');
  });

  it('drops a stale result when the session changes mid-flight', async () => {
    let resolveFirst!: (value: AccountActivity) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce({
      ...ACTIVITY,
      receivedSats: 500,
      receivedOverTime: [],
    });

    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0:0:0')).toBeTruthy();

    await act(async () => {
      useAuthStore.setState({ session: 'tok-bob' });
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
    fetchMock.mockResolvedValueOnce({
      ...ACTIVITY,
      receivedSats: 500,
      receivedOverTime: [],
    });

    renderWithLocale(<Probe />);
    expect(screen.getByText('loading:0:0:0:0')).toBeTruthy();

    await act(async () => {
      useAuthStore.setState({ session: 'tok-bob' });
    });

    await act(async () => {
      rejectFirst(new Error('fail'));
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:500:0:0')).toBeTruthy();
    });
  });

  it('clears totals when the session is dropped', async () => {
    fetchMock.mockResolvedValue(ACTIVITY);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('ready:0:1000:1:0')).toBeTruthy();
    });

    await act(async () => {
      useAuthStore.setState({ session: null, account: null });
    });

    await waitFor(() => {
      expect(screen.getByText('ready:0:0:0:0')).toBeTruthy();
    });
  });
});
