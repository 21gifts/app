import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/lib/api', () => ({
  postFundingApply: vi.fn(),
}));

import { postFundingApply } from '@/lib/api';

const applyMock = vi.mocked(postFundingApply);

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
  vi.clearAllMocks();
  applyMock.mockResolvedValue(pending);
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
    expect(screen.queryByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeNull();
    expect(applyMock).not.toHaveBeenCalled();
  });

  it('shows apply for none status with convictions and About link', () => {
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByText('You are not admitted to daily 21.gifts grant payouts.')).toBeTruthy();
    expect(screen.getByText('Giving is a duty')).toBeTruthy();
    expect(screen.getByText('Direct, with no middleman')).toBeTruthy();
    expect(screen.getByText('Bitcoin is the most effective money')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about');
    expect(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeTruthy();
  });

  it('treats missing funding as none for verified accounts', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, funding: undefined } });
    renderWithLocale(<FundingStatusCard />);
    expect(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeTruthy();
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
    expect(screen.getByText('You are not admitted to daily 21.gifts grant payouts.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeTruthy();
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
    expect(screen.queryByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeNull();
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
    expect(screen.queryByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeNull();
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

  it('applies and stores the returned funding object', async () => {
    renderWithLocale(<FundingStatusCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' }));
    await waitFor(() => {
      expect(applyMock).toHaveBeenCalledWith('sess');
    });
    await waitFor(() => {
      expect(useAuthStore.getState().account?.funding).toEqual(pending);
    });
    expect(
      screen.getByText('Your application is open. A moderator will review your posts.'),
    ).toBeTruthy();
  });

  it('shows apply-error copy when apply throws', async () => {
    applyMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<FundingStatusCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' }));
    expect(
      await screen.findByText('Could not submit your application. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeTruthy();
  });

  it('disables Apply and shows a spinner while apply is in flight', async () => {
    applyMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<FundingStatusCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' }));
    const button = screen.getByRole('button', {
      name: 'Apply for the 21 gifts grant',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();
    fireEvent.click(button);
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  it('does not write funding when the session changes during apply', async () => {
    let resolveApply: ((value: OwnerFunding) => void) | undefined;
    applyMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApply = resolve;
        }),
    );
    renderWithLocale(<FundingStatusCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' }));
    useAuthStore.setState({ session: 'other', account });
    await act(async () => {
      resolveApply?.(pending);
      await Promise.resolve();
    });
    expect(useAuthStore.getState().account?.funding?.status).toBe('none');
  });

  it('does not write funding when the account vanishes during apply', async () => {
    let resolveApply: ((value: OwnerFunding) => void) | undefined;
    applyMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApply = resolve;
        }),
    );
    renderWithLocale(<FundingStatusCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply for the 21 gifts grant' }));
    useAuthStore.setState({ session: 'sess', account: null });
    await act(async () => {
      resolveApply?.(pending);
      await Promise.resolve();
    });
    expect(useAuthStore.getState().account).toBeNull();
  });
});
