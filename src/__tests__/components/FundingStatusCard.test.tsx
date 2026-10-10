import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import type { Account, OwnerFunding } from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { grantApplicationsPaused } from '@/lib/grant-applications';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/grant-applications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/grant-applications')>();
  return {
    ...actual,
    grantApplicationsPaused: vi.fn(actual.grantApplicationsPaused),
  };
});

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
  vi.mocked(grantApplicationsPaused).mockReturnValue(true);
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

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

  it('shows the Apply link for username vincent when status is none', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, username: 'vincent' },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(
      screen.getByRole('link', { name: 'Apply for the 21 gifts grant' }).getAttribute('href'),
    ).toBe('/grants/apply');
    expect(
      screen.queryByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeNull();
  });

  it('shows pending copy and no Apply link for username vincent', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, username: 'vincent', funding: pending },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(
      screen.getByText('Your application is open. A moderator will review your posts.'),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it('shows not-verified copy for a basis account even with an open username', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', username: 'vincent', funding: null },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByText('You are not verified yet.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it('shows paused copy for none status', () => {
    renderWithLocale(<FundingStatusCard />);
    expect(screen.queryByText('You are not admitted to daily 21.gifts grant payouts.')).toBeNull();
    expect(
      screen.queryByText(
        'Daily grants go to people whose living-room posts reflect the three convictions.',
      ),
    ).toBeNull();
    expect(screen.queryByText('Giving is a duty')).toBeNull();
    expect(screen.queryByText('Direct, with no middleman')).toBeNull();
    expect(screen.queryByText('Bitcoin is the most effective money')).toBeNull();
    expect(
      screen.queryByText(
        'Admitted members receive the daily gift. Apply so a moderator can review your posts.',
      ),
    ).toBeNull();
    expect(
      screen.getByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'https://21.gifts/statistics' }).getAttribute('href'),
    ).toBe('https://21.gifts/statistics');
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it('treats missing funding as none for verified accounts', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, funding: undefined } });
    renderWithLocale(<FundingStatusCard />);
    expect(
      screen.getByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'https://21.gifts/statistics' }).getAttribute('href'),
    ).toBe('https://21.gifts/statistics');
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
    expect(
      screen.queryByText(
        'Admitted members receive the daily gift. Apply so a moderator can review your posts.',
      ),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
  });

  it('shows paused copy for rejected status', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        funding: { status: 'rejected', trialUtcDate: null, admittedAt: null, reviewedByName: null },
      },
    });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.queryByText('You are not admitted to daily 21.gifts grant payouts.')).toBeNull();
    expect(screen.queryByText('Giving is a duty')).toBeNull();
    expect(screen.queryByText('Direct, with no middleman')).toBeNull();
    expect(screen.queryByText('Bitcoin is the most effective money')).toBeNull();
    expect(
      screen.queryByText(
        'Admitted members receive the daily gift. Apply so a moderator can review your posts.',
      ),
    ).toBeNull();
    expect(
      screen.getByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'https://21.gifts/statistics' }).getAttribute('href'),
    ).toBe('https://21.gifts/statistics');
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
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
    vi.mocked(grantApplicationsPaused).mockReturnValue(false);
    renderWithLocale(<FundingStatusCard />);
    expect(
      screen.getByText(
        'Admitted members receive the daily gift. Apply so a moderator can review your posts.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about');
    expect(
      screen.getByRole('link', { name: 'Apply for the 21 gifts grant' }).getAttribute('href'),
    ).toBe('/grants/apply');
  });
});
