import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrantsScreen } from '@/components/GrantsScreen';
import type { Account, FundingApplication } from '@/lib/api-types';
import { consumePendingForumCompose, consumeSkipIntroduceOverlay } from '@/lib/forum-feed';
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

vi.mock('@/components/GrantPlacesPanel', () => ({
  GrantPlacesPanel: () => <div data-testid="grant-places-panel" />,
}));

vi.mock('@/lib/api', () => ({
  fetchFundingApplications: vi.fn(),
  fetchMe: vi.fn(),
}));

import { fetchFundingApplications, fetchMe } from '@/lib/api';

const listMock = vi.mocked(fetchFundingApplications);
const meMock = vi.mocked(fetchMe);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'verified',
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
  funding: {
    status: 'none',
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  },
};

const APPLICATION: FundingApplication = {
  accountId: 'acc_rose',
  name: 'Rose',
  role: 'verified',
  appliedAt: Date.parse('2026-08-28T12:00:00.000Z'),
};

const APPLICATION_NEIL: FundingApplication = {
  accountId: 'acc_neil',
  name: 'Neil',
  role: 'verified',
  appliedAt: Date.parse('2026-08-29T12:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  consumePendingForumCompose();
  consumeSkipIntroduceOverlay();
  listMock.mockResolvedValue([]);
  meMock.mockImplementation(() => new Promise<Account | null>(() => undefined));
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('GrantsScreen', () => {
  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<GrantsScreen />);
    expect(container.firstChild).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows the unverified explanation for a basis account', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', funding: null },
    });
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByText('You are not verified yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Goals' }).getAttribute('href')).toBe('/grants/goals');
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Daily payment text' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Daily payment amounts' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Moderator payments' })).toBeNull();
    expect(screen.queryByText('No open applications.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows the grant card without the staff queue for a verified member', () => {
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByText('21 gifts grant')).toBeTruthy();
    expect(screen.getByTestId('grant-places-panel')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Goals' }).getAttribute('href')).toBe('/grants/goals');
    expect(screen.queryByRole('link', { name: 'Daily payment text' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Daily payment amounts' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Moderator payments' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
    expect(screen.queryByText('No open applications.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("refreshes the sparse login account and shows today's payout from GET /me", async () => {
    const refreshed = {
      ...account,
      funding: {
        ...account.funding!,
        payoutToday: { state: 'paid' as const, reason: null },
      },
    };
    useAuthStore.setState({
      session: 'login-session',
      account: { ...account, funding: undefined },
    });
    meMock.mockResolvedValueOnce(refreshed);
    renderWithLocale(<GrantsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Payout made today.')).toBeTruthy();
    });
    expect(meMock).toHaveBeenCalledWith('login-session');
    expect(useAuthStore.getState().account).toEqual(refreshed);
  });

  it('keeps the login account when GET /me returns no account or fails', async () => {
    meMock.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
    const first = renderWithLocale(<GrantsScreen />);
    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Today's payout status is not available.")).toBeTruthy();
    first.unmount();

    renderWithLocale(<GrantsScreen />);
    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("Today's payout status is not available.")).toBeTruthy();
    expect(useAuthStore.getState().account).toEqual(account);
  });

  it('does not let a late grants refresh replace a newer session account', async () => {
    let resolveMe!: (next: Account | null) => void;
    meMock.mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveMe = resolve;
      }),
    );
    renderWithLocale(<GrantsScreen />);
    await waitFor(() => {
      expect(meMock).toHaveBeenCalledWith('sess');
    });

    const newer = { ...account, id: 'acc_2', name: 'Grace' };
    act(() => {
      useAuthStore.getState().setAuth('new-session', newer);
    });
    await act(async () => {
      resolveMe({
        ...account,
        funding: {
          ...account.funding!,
          payoutToday: { state: 'paid', reason: null },
        },
      });
    });
    expect(useAuthStore.getState()).toMatchObject({ session: 'new-session', account: newer });
  });

  it('keeps a new application while a slow grants refresh adds owner-only fields', async () => {
    let resolveMe!: (next: Account | null) => void;
    meMock.mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveMe = resolve;
      }),
    );
    renderWithLocale(<GrantsScreen />);
    await waitFor(() => {
      expect(meMock).toHaveBeenCalledWith('sess');
    });

    const pending = {
      ...account,
      name: 'New local name',
      funding: {
        ...account.funding!,
        status: 'pending' as const,
      },
    };
    act(() => {
      useAuthStore.getState().setAccount(pending);
    });
    await act(async () => {
      resolveMe({
        ...account,
        name: 'Stale name',
        funding: {
          ...account.funding!,
          status: 'none',
          payoutToday: { state: 'blocked', reason: 'admission' },
          shopPaymentDue: true,
        },
      });
    });

    expect(useAuthStore.getState().account).toEqual({
      ...pending,
      walletViewerPublicKey: undefined,
      grantPayoutToday: undefined,
      funding: {
        ...pending.funding,
        payoutToday: { state: 'blocked', reason: 'admission' },
        shopPaymentDue: true,
      },
    });
  });

  it('drops a grants refresh that answers after unmount', async () => {
    let resolveMe!: (next: Account | null) => void;
    meMock.mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveMe = resolve;
      }),
    );
    const rendered = renderWithLocale(<GrantsScreen />);
    await waitFor(() => {
      expect(meMock).toHaveBeenCalledWith('sess');
    });
    rendered.unmount();
    await act(async () => {
      resolveMe({ ...account, name: 'Late owner answer' });
    });
    expect(useAuthStore.getState().account).toBe(account);
  });

  it.each([
    [{ state: 'paid', reason: null }, 'Payout made today.', null],
    [{ state: 'paid', reason: 'welcome' }, 'Your welcome gift was paid today.', null],
    [{ state: 'due', reason: null }, "All conditions are met. Today's payout is on its way.", null],
    [
      { state: 'due', reason: 'payments_paused' },
      'All conditions are met, but payouts are paused right now.',
      null,
    ],
    [
      { state: 'blocked', reason: 'verify' },
      'A moderator must verify you in person first.',
      '/trust-chain',
    ],
    [{ state: 'blocked', reason: 'wallet' }, 'Set up your wallet to receive payouts.', '/wallet'],
    [
      { state: 'blocked', reason: 'recovery_share' },
      'Secure your account to receive payouts.',
      '/settings/social-recovery',
    ],
    [
      { state: 'blocked', reason: 'shop_payment' },
      'You must have made at least one purchase in a 21.gifts shop today or yesterday.',
      '/shops',
    ],
    [
      { state: 'blocked', reason: 'media_post' },
      'You must post at least one note with a photo today.',
      '/welcome',
    ],
  ] as const)('shows exactly one payout line for case %#', (payoutToday, copy, href) => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: { ...account.funding!, payoutToday },
      },
    });
    renderWithLocale(<GrantsScreen />);
    const group = screen.getByRole('group', { name: "Today's payout" });
    expect(within(group).getByText(copy)).toBeTruthy();
    expect(group.querySelectorAll('p')).toHaveLength(1);
    const link = within(group).queryByRole('link');
    expect(link?.getAttribute('href') ?? null).toBe(href);
  });

  it('shows the pending admission sentence without an apply link', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          ...account.funding!,
          status: 'pending',
          payoutToday: { state: 'blocked', reason: 'admission' },
        },
      },
    });
    renderWithLocale(<GrantsScreen />);
    const group = screen.getByRole('group', { name: "Today's payout" });
    expect(
      within(group).getByText(
        'You must be admitted to the grant program. Your application is being reviewed.',
      ),
    ).toBeTruthy();
    expect(within(group).queryByRole('link')).toBeNull();
  });

  it('requests the existing forum composer from the media-post sentence', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          ...account.funding!,
          payoutToday: { state: 'blocked', reason: 'media_post' },
        },
      },
    });
    renderWithLocale(<GrantsScreen />);
    fireEvent.click(
      screen.getByRole('link', {
        name: 'You must post at least one note with a photo today.',
      }),
    );
    expect(consumePendingForumCompose()).toBe(true);
    expect(consumeSkipIntroduceOverlay()).toBe(true);
  });

  it.each(['none', 'rejected'] as const)(
    'links an admission-blocked %s grant to the existing apply flow',
    (status) => {
      useAuthStore.setState({
        session: 'sess',
        account: {
          ...account,
          funding: {
            ...account.funding!,
            status,
            payoutToday: { state: 'blocked', reason: 'admission' },
          },
        },
      });
      renderWithLocale(<GrantsScreen />);
      expect(
        screen
          .getByRole('group', { name: "Today's payout" })
          .querySelector('a')
          ?.getAttribute('href'),
      ).toBe('/grants/apply');
    },
  );

  it('shows admission as information for a non-application funding status', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          ...account.funding!,
          status: 'trial',
          payoutToday: { state: 'blocked', reason: 'admission' },
        },
      },
    });
    renderWithLocale(<GrantsScreen />);
    const group = screen.getByRole('group', { name: "Today's payout" });
    expect(within(group).getByText('You must be admitted to the grant program.')).toBeTruthy();
    expect(within(group).queryByRole('link')).toBeNull();
  });

  it.each([
    null,
    { state: 'paid', reason: 'unknown' },
    { state: 'due', reason: 'unknown' },
    { state: 'blocked', reason: 'unknown' },
  ] as const)('falls back safely for unavailable payout value %#', (payoutToday) => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: { ...account.funding!, payoutToday },
      },
    });
    renderWithLocale(<GrantsScreen />);
    const group = screen.getByRole('group', { name: "Today's payout" });
    expect(within(group).getByText("Today's payout status is not available.")).toBeTruthy();
    expect(group.querySelectorAll('p')).toHaveLength(1);
    expect(within(group).queryByRole('link')).toBeNull();
  });

  it('reads the basis-account compatibility payout field', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        role: 'basis',
        funding: null,
        grantPayoutToday: { state: 'paid', reason: 'welcome' },
      },
    });
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByText('Your welcome gift was paid today.')).toBeTruthy();
  });

  it('prefers the payout nested in funding over the compatibility field', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          ...account.funding!,
          payoutToday: { state: 'paid', reason: null },
        },
        grantPayoutToday: { state: 'paid', reason: 'welcome' },
      },
    });
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByText('Payout made today.')).toBeTruthy();
    expect(screen.queryByText('Your welcome gift was paid today.')).toBeNull();
  });

  it('keeps a null funding payout unavailable instead of using the compatibility field', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          ...account.funding!,
          payoutToday: null,
        },
        grantPayoutToday: { state: 'paid', reason: 'welcome' },
      },
    });
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByText("Today's payout status is not available.")).toBeTruthy();
    expect(screen.queryByText('Your welcome gift was paid today.')).toBeNull();
  });

  it('shows the grant card without the staff queue when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<GrantsScreen />);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Goals' })).toBeNull();
    expect(screen.queryByText('21 gifts grant')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
    expect(screen.queryByText('No open applications.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it.each(['moderator', 'founder'] as const)(
    'shows loading copy for a %s without an applications link',
    (role) => {
      listMock.mockImplementation(() => new Promise(() => undefined));
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      renderWithLocale(<GrantsScreen />);
      expect(screen.getByText('Loading…')).toBeTruthy();
      expect(screen.queryByRole('link', { name: /Open applications/ })).toBeNull();
      if (role === 'founder') {
        expect(screen.getByRole('link', { name: 'Daily payment text' }).getAttribute('href')).toBe(
          '/grants/payments/comment',
        );
        expect(
          screen.getByRole('link', { name: 'Daily payment amounts' }).getAttribute('href'),
        ).toBe('/grants/payments/amounts');
        expect(screen.getByRole('link', { name: 'Moderator payments' }).getAttribute('href')).toBe(
          '/grants/payments/moderators',
        );
      } else {
        expect(screen.queryByRole('link', { name: 'Daily payment text' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Daily payment amounts' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Moderator payments' })).toBeNull();
      }
    },
  );

  it('shows daily payments for an initiator and still loads applications', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'initiator' } });
    listMock.mockResolvedValue([]);
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByRole('link', { name: 'Daily payment text' }).getAttribute('href')).toBe(
      '/grants/payments/comment',
    );
    expect(screen.getByRole('link', { name: 'Daily payment amounts' }).getAttribute('href')).toBe(
      '/grants/payments/amounts',
    );
    expect(screen.getByRole('link', { name: 'Moderator payments' }).getAttribute('href')).toBe(
      '/grants/payments/moderators',
    );
    expect(await screen.findByText('No open applications.')).toBeTruthy();
    expect(listMock).toHaveBeenCalledWith('sess');
  });

  it('shows empty copy without a link or button', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    listMock.mockResolvedValue([]);
    renderWithLocale(<GrantsScreen />);
    expect(await screen.findByText('No open applications.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Open applications/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Daily payment text' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Daily payment amounts' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Moderator payments' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('links to the open applications queue with a count of two', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    listMock.mockResolvedValue([APPLICATION, APPLICATION_NEIL]);
    renderWithLocale(<GrantsScreen />);
    expect(
      (await screen.findByRole('link', { name: 'Open applications (2)' })).getAttribute('href'),
    ).toBe('/grants/applications');
  });

  it('links to the open applications queue with a count of one', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    listMock.mockResolvedValue([APPLICATION]);
    renderWithLocale(<GrantsScreen />);
    expect(
      (await screen.findByRole('link', { name: 'Open application (1)' })).getAttribute('href'),
    ).toBe('/grants/applications');
  });

  it('shows an error and retries', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    listMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([APPLICATION]);
    renderWithLocale(<GrantsScreen />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load open applications. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Open application (1)' })).toBeTruthy();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale resolve after unmount', async () => {
    let resolveList: ((value: FundingApplication[]) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    const view = renderWithLocale(<GrantsScreen />);
    view.unmount();
    await act(async () => {
      resolveList?.([APPLICATION]);
      await Promise.resolve();
    });
    expect(screen.queryByRole('link', { name: /Open applications/ })).toBeNull();
  });

  it('ignores a stale reject after unmount', async () => {
    let rejectList: ((reason: Error) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectList = reject;
        }),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    const view = renderWithLocale(<GrantsScreen />);
    view.unmount();
    await act(async () => {
      rejectList?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByText('Could not load open applications. Please try again.')).toBeNull();
  });

  it('does not apply a late resolve after the session is cleared', async () => {
    let resolveList: ((value: FundingApplication[]) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    const { container } = renderWithLocale(<GrantsScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).toBeNull();
    });
    await act(async () => {
      resolveList?.([APPLICATION]);
      await Promise.resolve();
    });
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('link', { name: /Open applications/ })).toBeNull();
  });
});
