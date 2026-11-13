import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import type { Account, OwnerFunding } from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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

const pending: OwnerFunding = {
  status: 'pending',
  trialUtcDate: null,
  admittedAt: null,
  reviewedByName: null,
};

beforeEach(() => {
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FundingStatusCard', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<FundingStatusCard />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there is no account', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<FundingStatusCard />);
    expect(container.firstChild).toBeNull();
  });

  it('shows not-verified copy for a basis account and no apply button', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', funding: null },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByRole('heading', { name: '21 gifts grant', level: 1 })).toBeTruthy();
    expect(screen.getByText('You are not verified yet.')).toBeTruthy();
    expect(
      screen.getByText(
        'A moderator who personally knows you and has met you in the real world can confirm you on your member page.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it('shows not-verified copy for a basis account', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', funding: null },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByText('You are not verified yet.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it.each([
    ['none', account.funding],
    ['missing', undefined],
    [
      'rejected',
      { status: 'rejected' as const, trialUtcDate: null, admittedAt: null, reviewedByName: null },
    ],
  ])('offers About and Apply for %s funding', (_label, funding) => {
    useAuthStore.setState({ session: 'sess', account: { ...account, funding } });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.queryByText('You are not admitted to daily 21.gifts grant payouts.')).toBeNull();
    expect(
      screen.queryByText(
        'Daily grants go to people whose living-room posts reflect the three convictions.',
      ),
    ).toBeNull();
    expect(screen.queryByText('Giving is part of faith')).toBeNull();
    expect(screen.queryByText('Directly from person to person')).toBeNull();
    expect(screen.queryByText('Why Bitcoin?')).toBeNull();
    expect(
      screen.queryByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: 'https://21.gifts/statistics' })).toBeNull();
    expect(
      screen.getByText(
        'Admitted members receive the daily gift. Apply so a moderator can review your posts.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About 21.gifts' }).getAttribute('href')).toBe(
      '/about',
    );
    expect(
      screen.getByRole('link', { name: 'Apply for the 21 gifts grant' }).getAttribute('href'),
    ).toBe('/grants/apply');
  });

  it('shows pending copy and no apply button', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, funding: pending },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(
      screen.getByText('Your application is open. A moderator will review your posts.'),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it('shows trial copy', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          status: 'trial',
          trialUtcDate: '2026-09-20',
          admittedAt: null,
          reviewedByName: null,
        },
      },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByText('You are on a one-day trial. Review repeats tomorrow.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it('shows admitted copy with reviewed date', () => {
    const admittedAt = Date.parse('2026-08-28T12:00:00.000Z');
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          status: 'admitted',
          trialUtcDate: null,
          admittedAt,
          reviewedByName: 'Ada',
        },
      },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByText('You are admitted to daily 21.gifts grant payouts.')).toBeTruthy();
    expect(
      screen.getByText(
        `Takes part in the 21.gifts funding program since ${formatForumTimeFromMs(
          admittedAt,
          'en',
        )}, reviewed by Ada`,
      ),
    ).toBeTruthy();
  });

  it('keeps the old admitted sentence when reviewedByName is null', () => {
    const admittedAt = Date.parse('2026-08-28T12:00:00.000Z');
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          status: 'admitted',
          trialUtcDate: null,
          admittedAt,
          reviewedByName: null,
        },
      },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(
      screen.getByText(
        `Takes part in the 21.gifts funding program since ${formatForumTimeFromMs(
          admittedAt,
          'en',
        )}`,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Ada/)).toBeNull();
  });

  it('shows admitted copy without a date when admittedAt is null', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          status: 'admitted',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByText('Takes part in the 21.gifts funding program')).toBeTruthy();
  });

  it('offers the apply link', () => {
    renderWithLocale(<FundingStatusCard />);
    expect(
      screen.getByText(
        'Admitted members receive the daily gift. Apply so a moderator can review your posts.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About 21.gifts' }).getAttribute('href')).toBe(
      '/about',
    );
    expect(
      screen.getByRole('link', { name: 'Apply for the 21 gifts grant' }).getAttribute('href'),
    ).toBe('/grants/apply');
  });

  it.each([
    ['pending', 'Withdraw my application'],
    ['trial', 'Leave the grant'],
    ['admitted', 'Leave the grant'],
  ] as const)('offers the way out under the %s status text', (status, label) => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          status,
          trialUtcDate: status === 'trial' ? '2026-09-20' : null,
          admittedAt: status === 'admitted' ? 1_700_000_000_000 : null,
          reviewedByName: null,
        },
      },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it.each(['none', 'rejected'] as const)('offers no way out for status %s', (status) => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, funding: { ...pending, status } },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.queryByRole('button', { name: 'Withdraw my application' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Leave the grant' })).toBeNull();
  });

  it('offers no way out to a basis account', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', funding: null },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.queryByRole('button', { name: 'Leave the grant' })).toBeNull();
  });

  it('shows the apply state again after leaving the grant', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: {
          status: 'admitted',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          funding: { status: 'none', trialUtcDate: null, admittedAt: null, reviewedByName: null },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<FundingStatusCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeTruthy();
    });
    // The withdraw answer, then the owner refresh that loads today's payout reason.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/funding/withdraw');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/me');
    expect(screen.queryByRole('button', { name: 'Leave the grant' })).toBeNull();
  });
});
