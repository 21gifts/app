import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingApplicationsScreen } from '@/components/FundingApplicationsScreen';
import type { Account, FundingApplication } from '@/lib/api-types';
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
  fetchFundingApplications: vi.fn(),
}));

import { fetchFundingApplications } from '@/lib/api';

const listMock = vi.mocked(fetchFundingApplications);

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

const APPLICATION: FundingApplication = {
  accountId: 'acc_rose',
  name: 'Rose',
  role: 'verified',
  appliedAt: Date.parse('2026-08-28T12:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('FundingApplicationsScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<FundingApplicationsScreen />);
    expect(container.firstChild).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a basis account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    renderWithLocale(<FundingApplicationsScreen />);
    expect(screen.getByRole('heading', { name: 'Open applications' })).toBeTruthy();
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(screen.queryByText('No open applications.')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe('/moderate');
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a verified account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<FundingApplicationsScreen />);
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<FundingApplicationsScreen />);
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows loading heading and copy', () => {
    listMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<FundingApplicationsScreen />);
    expect(screen.getByRole('heading', { name: 'Open applications' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows empty copy', async () => {
    listMock.mockResolvedValue([]);
    renderWithLocale(<FundingApplicationsScreen />);
    expect(await screen.findByText('No open applications.')).toBeTruthy();
    expect(listMock).toHaveBeenCalledWith('sess');
  });

  it('shows an error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([APPLICATION]);
    renderWithLocale(<FundingApplicationsScreen />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load open applications. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Rose' })).toBeTruthy();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('fetches for a founder account', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    listMock.mockResolvedValue([APPLICATION]);
    renderWithLocale(<FundingApplicationsScreen />);
    expect(await screen.findByRole('link', { name: 'Rose' })).toBeTruthy();
    expect(listMock).toHaveBeenCalledWith('sess');
  });

  it('shows an application with a detail link and applied time', async () => {
    listMock.mockResolvedValue([APPLICATION]);
    renderWithLocale(<FundingApplicationsScreen />);
    expect(await screen.findByRole('heading', { name: 'Open applications' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Rose' }).getAttribute('href')).toBe(
      '/moderate/applications/acc_rose',
    );
    expect(screen.getByText(formatForumTimeFromMs(APPLICATION.appliedAt, 'en'))).toBeTruthy();
  });

  it('falls back to Unnamed for empty and null names', async () => {
    listMock.mockResolvedValue([
      { accountId: 'acc_x', name: null, role: 'verified', appliedAt: APPLICATION.appliedAt },
      { accountId: 'acc_y', name: '', role: 'verified', appliedAt: APPLICATION.appliedAt },
    ]);
    renderWithLocale(<FundingApplicationsScreen />);
    expect(await screen.findAllByRole('link', { name: 'Unnamed' })).toHaveLength(2);
  });

  it('ignores a stale resolve after unmount', async () => {
    let resolveList: ((value: FundingApplication[]) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const view = renderWithLocale(<FundingApplicationsScreen />);
    view.unmount();
    await act(async () => {
      resolveList?.([APPLICATION]);
      await Promise.resolve();
    });
    expect(screen.queryByText('Rose')).toBeNull();
  });

  it('ignores a stale reject after unmount', async () => {
    let rejectList: ((reason: Error) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectList = reject;
        }),
    );
    const view = renderWithLocale(<FundingApplicationsScreen />);
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
    renderWithLocale(<FundingApplicationsScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).toBeNull();
    });
    await act(async () => {
      resolveList?.([APPLICATION]);
      await Promise.resolve();
    });
    expect(screen.queryByText('Rose')).toBeNull();
  });
});
