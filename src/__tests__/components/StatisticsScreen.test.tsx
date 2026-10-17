import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsScreen } from '@/components/StatisticsScreen';
import type { Account } from '@/lib/api-types';
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
  fetchGiftStats: vi.fn(),
  fetchShopActivity: vi.fn(),
}));

import { fetchGiftStats, fetchShopActivity } from '@/lib/api';
import type { GiftStats, ShopActivityDay } from '@/lib/api-types';

const fetchMock = vi.mocked(fetchGiftStats);
const fetchShopMock = vi.mocked(fetchShopActivity);

const EMPTY_STATS: GiftStats = {
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

function shopActivityDays(
  endDay = '2026-09-20',
  counts: Record<string, number> = {},
): ShopActivityDay[] {
  const endMs = Date.parse(`${endDay}T00:00:00.000Z`);
  return Array.from({ length: 30 }, (_, i) => {
    const day = new Date(endMs - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, shopCount: counts[day] ?? 0 };
  });
}

function statsWithDays(
  days: { day: string; giftCount: number; officialCount?: number }[],
): GiftStats {
  return {
    ...EMPTY_STATS,
    giftCount: days.reduce((sum, row) => sum + row.giftCount, 0),
    spendOverTime: days.map((row) => ({
      day: row.day,
      giftCount: row.giftCount,
      officialCount: row.officialCount ?? row.giftCount,
      sats: 0,
      cumulativeSats: 0,
      btc: '0.00000000',
      cumulativeBtc: '0.00000000',
      usd: '0.00',
      cumulativeUsd: '0.00',
      chf: '0.00',
      eur: '0.00',
      php: '0.00',
      cumulativeChf: '0.00',
      cumulativeEur: '0.00',
      cumulativePhp: '0.00',
    })),
  };
}

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator',
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
  useAuthStore.setState({ session: 'sess', account });
  fetchMock.mockResolvedValue(EMPTY_STATS);
  fetchShopMock.mockResolvedValue(shopActivityDays());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StatisticsScreen', () => {
  it('fetches both feeds and shows Statistics when session and account are null', async () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<StatisticsScreen />);
    expect(screen.getByRole('heading', { name: 'Statistics' })).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(fetchShopMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('staff-functions')).toBeNull();
  });

  it.each(['basis', 'verified'] as const)(
    'shows both charts for a %s account and does not show Moderator functions',
    async (role) => {
      fetchMock.mockResolvedValue(
        statsWithDays([{ day: '2026-09-19', giftCount: 40, officialCount: 12 }]),
      );
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      renderWithLocale(<StatisticsScreen />);
      await waitFor(() => {
        expect(screen.getByText('People by UTC day')).toBeTruthy();
        expect(screen.getByText('Shops by UTC day')).toBeTruthy();
      });
      expect(fetchMock).toHaveBeenCalled();
      expect(fetchShopMock).toHaveBeenCalled();
      expect(screen.queryByTestId('staff-functions')).toBeNull();
      expect(screen.queryByText('This page is for moderators.')).toBeNull();
    },
  );

  it.each(['moderator', 'founder'] as const)(
    'shows the open chart for a %s account',
    async (role) => {
      fetchMock.mockResolvedValue(
        statsWithDays([{ day: '2026-09-19', giftCount: 40, officialCount: 12 }]),
      );
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      renderWithLocale(<StatisticsScreen />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Statistics' })).toBeTruthy();
        expect(screen.getByText('Yesterday (UTC September 19): 12 people')).toBeTruthy();
      });
      expect(screen.getByText('People by UTC day')).toBeTruthy();
      expect(
        screen.getByText(
          'Each person counts once on the UTC day 21.gifts paid them the daily funding or the welcome gift. Someone who receives both that day counts once. Moderator stipends and gifts between members do not count. The current UTC day is drawn lighter because it is still open.',
        ),
      ).toBeTruthy();
      expect(screen.getByText('Moderator functions')).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Show payout per person' })).toBeNull();
      fireEvent.click(screen.getByText('Moderator functions'));
      expect(
        screen.getByRole('link', { name: 'Show payout per person' }).getAttribute('href'),
      ).toBe('/moderate/payouts');
      expect(screen.queryByRole('button', { name: /Goal/ })).toBeNull();
      expect(screen.queryByText('Tap to close')).toBeNull();
      expect(screen.queryByText('12%')).toBeNull();
      expect(screen.queryByText('Goal')).toBeNull();
    },
  );

  it('shows loading copy while payout stats are in flight', async () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Shops by UTC day')).toBeTruthy();
    });
    expect(
      within(screen.getByRole('group', { name: 'People paid' })).getByText('Loading…'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'Active shops' })).queryByText('Loading…'),
    ).toBeNull();
    expect(screen.queryByTestId('staff-functions')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Show payout per person' })).toBeNull();
  });

  it('shows the payout chart while shop activity is in flight', async () => {
    fetchShopMock.mockImplementation(() => new Promise(() => undefined));
    fetchMock.mockResolvedValue(
      statsWithDays([{ day: '2026-09-19', giftCount: 40, officialCount: 12 }]),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(screen.getByText('People by UTC day')).toBeTruthy();
    });
    expect(
      within(screen.getByRole('group', { name: 'Active shops' })).getByText('Loading…'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'People paid' })).queryByText('Loading…'),
    ).toBeNull();
    expect(screen.getByTestId('staff-functions')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Show payout per person' })).toBeNull();
  });

  it('shows retry when payout stats fail to load', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Could not load payouts. Please try again.')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByTestId('staff-functions')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Show payout per person' })).toBeNull();
    fetchMock.mockResolvedValue(EMPTY_STATS);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows retry when a spend day omits officialCount', async () => {
    fetchMock.mockResolvedValue({
      ...EMPTY_STATS,
      spendOverTime: [
        {
          day: '2026-09-19',
          giftCount: 40,
          sats: 1,
          cumulativeSats: 1,
          btc: '0.00000001',
          cumulativeBtc: '0.00000001',
          usd: '0.01',
          cumulativeUsd: '0.01',
          chf: '0.01',
          eur: '0.01',
          php: '0.50',
          cumulativeChf: '0.01',
          cumulativeEur: '0.01',
          cumulativePhp: '0.50',
        },
      ],
    });
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Could not load payouts. Please try again.',
      );
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('People by UTC day')).toBeNull();
    expect(screen.queryByTestId('staff-functions')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Show payout per person' })).toBeNull();
  });

  it('shows the shop explainer and the payout chart for staff', async () => {
    fetchMock.mockResolvedValue(
      statsWithDays([{ day: '2026-09-19', giftCount: 40, officialCount: 12 }]),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(
        screen.getByText(
          'A shop counts on a UTC day when a 21.gifts user is assigned to it and that user created a point-of-sale payment that day at https://21.gifts/pos.',
        ),
      ).toBeTruthy();
    });
    expect(screen.getByText('People by UTC day')).toBeTruthy();
  });

  it('keeps the payout chart when shop activity fails', async () => {
    fetchShopMock.mockRejectedValue(new Error('offline'));
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Could not load shop activity. Please try again.')).toBeTruthy();
      expect(screen.getByText('People by UTC day')).toBeTruthy();
    });
    expect(screen.getByTestId('staff-functions')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Show payout per person' })).toBeNull();
    fetchShopMock.mockResolvedValue(shopActivityDays());
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Active shops' })).getByRole('button', {
        name: 'Try again',
      }),
    );
    await waitFor(() => {
      expect(fetchShopMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('People by UTC day')).toBeTruthy();
  });

  it('keeps the shop chart when payout stats fail', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Could not load payouts. Please try again.')).toBeTruthy();
      expect(screen.getByText('Shops by UTC day')).toBeTruthy();
    });
    expect(screen.queryByTestId('staff-functions')).toBeNull();
  });

  it('ignores payout and shop results that arrive after unmount', async () => {
    let resolvePayout!: (value: GiftStats) => void;
    let resolveShop!: (value: ShopActivityDay[]) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePayout = resolve;
        }),
    );
    fetchShopMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveShop = resolve;
        }),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    const { unmount } = renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(fetchShopMock).toHaveBeenCalled();
    });
    unmount();
    await act(async () => {
      resolvePayout(EMPTY_STATS);
      resolveShop(shopActivityDays());
    });
    expect(screen.queryByRole('heading', { name: 'Statistics' })).toBeNull();
  });

  it('ignores payout and shop failures that arrive after unmount', async () => {
    let rejectPayout!: (reason: Error) => void;
    let rejectShop!: (reason: Error) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPayout = reject;
        }),
    );
    fetchShopMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectShop = reject;
        }),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    const { unmount } = renderWithLocale(<StatisticsScreen />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(fetchShopMock).toHaveBeenCalled();
    });
    unmount();
    await act(async () => {
      rejectPayout(new Error('offline'));
      rejectShop(new Error('offline'));
    });
    expect(screen.queryByRole('heading', { name: 'Statistics' })).toBeNull();
  });
});
