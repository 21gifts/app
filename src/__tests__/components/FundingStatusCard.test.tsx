import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import type { Account, OwnerFunding } from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
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

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'verified',
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
    expect(screen.getByText('21 gifts grant')).toBeTruthy();
    expect(screen.getByText('You are not verified yet.')).toBeTruthy();
    expect(
      screen.getByText(
        'A moderator who personally knows you and has met you in the real world can confirm you on your member page.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it('shows apply for none status with About link', () => {
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
      screen.getByText(
        'Daily gifts continue as usual until 25 September 2026. From that day, only admitted members receive them. Apply now so a moderator can review your posts.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about');
    expect(
      screen.getByRole('link', { name: 'Apply for the 21 gifts grant' }).getAttribute('href'),
    ).toBe('/profile/apply');
  });

  it('treats missing funding as none for verified accounts', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, funding: undefined } });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeTruthy();
  });

  it('shows apply for rejected status', () => {
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
      screen.getByText(
        'Daily gifts continue as usual until 25 September 2026. From that day, only admitted members receive them. Apply now so a moderator can review your posts.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeTruthy();
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
      screen.getByText(`Reviewed by a moderator on ${formatForumTimeFromMs(admittedAt, 'en')}`),
    ).toBeTruthy();
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
    expect(screen.getByText('Reviewed by a moderator')).toBeTruthy();
  });
});
