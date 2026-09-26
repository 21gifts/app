import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrantsScreen } from '@/components/GrantsScreen';
import type { Account, FundingApplication } from '@/lib/api-types';
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
  fetchFundingApplications: vi.fn(),
}));

import { fetchFundingApplications } from '@/lib/api';

const listMock = vi.mocked(fetchFundingApplications);

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
  listMock.mockResolvedValue([]);
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
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
    expect(screen.queryByText('No open applications.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows the grant card without the staff queue for a verified member', () => {
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByText('21 gifts grant')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
    expect(screen.queryByText('No open applications.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows the grant card without the staff queue when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<GrantsScreen />);
    expect(container.querySelector('a')).toBeNull();
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
    },
  );

  it('shows empty copy without a link or button', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    listMock.mockResolvedValue([]);
    renderWithLocale(<GrantsScreen />);
    expect(await screen.findByText('No open applications.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Open applications/ })).toBeNull();
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
      (await screen.findByRole('link', { name: 'Open applications (1)' })).getAttribute('href'),
    ).toBe('/grants/applications');
  });

  it('shows an error and retries', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    listMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([APPLICATION]);
    renderWithLocale(<GrantsScreen />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load open applications. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Open applications (1)' })).toBeTruthy();
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
