import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerateScreen } from '@/components/ModerateScreen';
import type { Account, Conversation, ModeratorProposal } from '@/lib/api-types';
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
  listHiddenMessages: vi.fn(),
  fetchNotifications: vi.fn(),
  fetchConversations: vi.fn(),
  fetchModeratorGroup: vi.fn(),
  fetchTrustProposals: vi.fn(),
}));

import {
  fetchConversations,
  fetchGiftStats,
  fetchModeratorGroup,
  fetchNotifications,
  fetchTrustProposals,
} from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';

const fetchMock = vi.mocked(fetchGiftStats);
const notificationsMock = vi.mocked(fetchNotifications);
const conversationsMock = vi.mocked(fetchConversations);
const groupMock = vi.mocked(fetchModeratorGroup);
const proposalsMock = vi.mocked(fetchTrustProposals);

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

function statsWithDays(days: { day: string; giftCount: number }[]): GiftStats {
  return {
    ...EMPTY_STATS,
    giftCount: days.reduce((sum, row) => sum + row.giftCount, 0),
    spendOverTime: days.map((row) => ({
      day: row.day,
      giftCount: row.giftCount,
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

const GROUP: Conversation = {
  id: 'conv-mod',
  kind: 'moderator_group',
  name: 'Moderators',
  lastText: 'Hello mods',
  lastAt: '2026-08-28T15:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unreadMessageCount: 0,
  unread: false,
};

const PROPOSAL: ModeratorProposal = {
  subject: { id: 'acc_rose', name: 'Rose', role: 'verified' },
  proposedBy: { id: 'acc_bob', name: 'Bob' },
  createdAt: '2026-08-28T12:00:00.000Z',
};

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
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
  notificationsMock.mockResolvedValue({ notifications: [], unreadCount: 0 });
  conversationsMock.mockResolvedValue([]);
  groupMock.mockResolvedValue(GROUP);
  proposalsMock.mockResolvedValue([]);
  useAuthStore.setState({ session: 'sess', account });
  fetchMock.mockResolvedValue(EMPTY_STATS);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ModerateScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ModerateScreen />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a basis account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    renderWithLocale(<ModerateScreen />);
    expect(screen.getByRole('heading', { name: 'Moderation' })).toBeTruthy();
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Hidden notes' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open proposals' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Moderators chat group' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Handbook' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Moderation tools' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a verified account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<ModerateScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Hidden notes' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open proposals' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Moderators chat group' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Handbook' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<ModerateScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open proposals' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Handbook' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['founder', 'moderator'] as const)(
    'shows the hub, Hidden notes, and Moderators links for a %s and fetches payout stats',
    async (role) => {
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      renderWithLocale(<ModerateScreen />);
      expect(screen.getByRole('heading', { name: 'Moderation' })).toBeTruthy();
      expect(screen.queryByText('Tools for moderators.')).toBeNull();
      expect(
        screen.queryByText(
          'Hiding a note is a soft hide: the note and its untagged direct replies leave the living room. It is not a hard delete.',
        ),
      ).toBeNull();
      expect(screen.queryByText('Closed staff room for moderators.')).toBeNull();
      expect(
        screen.queryByText(
          'Pick a person, then walk each principle and whether the posts are true.',
        ),
      ).toBeNull();
      expect(screen.getByRole('list', { name: 'Moderation tools' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Hidden notes' }).getAttribute('href')).toBe(
        '/moderate/hidden',
      );
      expect(screen.getByRole('link', { name: 'Open proposals' }).getAttribute('href')).toBe(
        '/moderate/proposals',
      );
      expect(screen.getByRole('link', { name: 'Open applications' }).getAttribute('href')).toBe(
        '/moderate/applications',
      );
      expect(screen.getByRole('link', { name: 'Moderators chat group' }).getAttribute('href')).toBe(
        '/moderate/group',
      );
      expect(screen.getByRole('link', { name: 'Handbook' }).getAttribute('href')).toBe(
        '/moderate/handbook',
      );
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    },
  );

  it('shows yesterday as a percent of 100 and expands the chart', async () => {
    fetchMock.mockResolvedValue(
      statsWithDays([
        { day: '2026-08-24', giftCount: 36 },
        { day: '2026-09-19', giftCount: 12 },
        { day: '2026-09-20', giftCount: 9 },
      ]),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<ModerateScreen />);
    await waitFor(() => {
      expect(screen.getByText('12%')).toBeTruthy();
    });
    expect(screen.getByText('yesterday 12 of 100')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Goal/ }));
    expect(screen.getByText(/Official means 21.gifts itself paid/)).toBeTruthy();
    expect(screen.getByText('36')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Goal/ }));
    expect(screen.queryByText(/Official means 21.gifts itself paid/)).toBeNull();
  });

  it('caps the bar at 100 percent when yesterday exceeds the goal', async () => {
    fetchMock.mockResolvedValue(statsWithDays([{ day: '2026-09-19', giftCount: 150 }]));
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<ModerateScreen />);
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeTruthy();
    });
    expect(screen.getByText('yesterday 150 of 100')).toBeTruthy();
    expect(screen.getByTestId('payout-goal-fill').getAttribute('width')).toBe('100');
    fireEvent.click(screen.getByRole('button', { name: /Goal/ }));
    const chartBars = screen.getAllByTestId('payout-goal-chart-bar');
    expect(chartBars.length).toBeGreaterThan(0);
    for (const bar of chartBars) {
      expect(Number(bar.getAttribute('height'))).toBeLessThanOrEqual(220);
      expect(Number(bar.getAttribute('y'))).toBeGreaterThanOrEqual(24);
    }
  });

  it('shows loading copy while payout stats are in flight', () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<ModerateScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('treats a missing giftCount as zero', async () => {
    fetchMock.mockResolvedValue({
      ...EMPTY_STATS,
      spendOverTime: [
        {
          day: '2026-09-19',
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
    renderWithLocale(<ModerateScreen />);
    await waitFor(() => {
      expect(screen.getByText('0%')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Goal/ }));
    expect(screen.getByText('Official payouts by UTC day')).toBeTruthy();
  });

  it('opens an empty chart when there are no gifts', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<ModerateScreen />);
    await waitFor(() => {
      expect(screen.getByText('0%')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Goal/ }));
    expect(screen.getByText('Official payouts by UTC day')).toBeTruthy();
  });

  it('ignores a stale stats resolve after unmount', async () => {
    let resolveStats: ((value: GiftStats) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStats = resolve;
        }),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    const view = renderWithLocale(<ModerateScreen />);
    view.unmount();
    await act(async () => {
      resolveStats?.(EMPTY_STATS);
      await Promise.resolve();
    });
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('ignores a stale stats reject after unmount', async () => {
    let rejectStats: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectStats = reject;
        }),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    const view = renderWithLocale(<ModerateScreen />);
    view.unmount();
    await act(async () => {
      rejectStats?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByText('Could not load payouts. Please try again.')).toBeNull();
  });

  it('shows retry when payout stats fail to load', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<ModerateScreen />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Could not load payouts. Please try again.',
      );
    });
    fetchMock.mockResolvedValue(EMPTY_STATS);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the unread count on Moderators when the group is unread', async () => {
    groupMock.mockResolvedValue({ ...GROUP, unread: true });
    renderWithLocale(<ModerateScreen />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Moderators chat group, 1 unread' })).toBeTruthy();
    });
    const moderators = screen.getByRole('link', { name: 'Moderators chat group, 1 unread' });
    expect(moderators.getAttribute('href')).toBe('/moderate/group');
    expect(moderators.textContent).toContain('1');
    expect(
      screen.getByRole('link', { name: 'Open proposals' }).getAttribute('aria-label'),
    ).toBeNull();
  });

  it('shows the unread count on Open proposals when there is one proposal', async () => {
    proposalsMock.mockResolvedValue([PROPOSAL]);
    renderWithLocale(<ModerateScreen />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Open proposals, 1 unread' })).toBeTruthy();
    });
    const openProposals = screen.getByRole('link', { name: 'Open proposals, 1 unread' });
    expect(openProposals.getAttribute('href')).toBe('/moderate/proposals');
    expect(openProposals.textContent).toContain('1');
    const count = openProposals.querySelector('.tabular-nums');
    expect(count?.textContent).toBe('1');
    expect(screen.getByRole('link', { name: 'Moderators chat group' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Moderators chat group, 1 unread' })).toBeNull();
  });

  it('keeps Moderators chat group count on staff-room unread when there are open proposals', async () => {
    groupMock.mockResolvedValue({ ...GROUP, unread: true });
    proposalsMock.mockResolvedValue([PROPOSAL]);
    renderWithLocale(<ModerateScreen />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Open proposals, 1 unread' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Moderators chat group, 1 unread' })).toBeTruthy();
    });
  });

  it('omits the Open proposals aria-label when there are no proposals', async () => {
    renderWithLocale(<ModerateScreen />);
    const openProposals = await screen.findByRole('link', { name: 'Open proposals' });
    expect(openProposals.getAttribute('aria-label')).toBeNull();
  });
});
