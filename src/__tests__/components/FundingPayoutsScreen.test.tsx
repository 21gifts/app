import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingPayoutsScreen } from '@/components/FundingPayoutsScreen';
import type { Account, FundingPayoutDays } from '@/lib/api-types';
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
  fetchFundingPayoutDays: vi.fn(),
}));

import { fetchFundingPayoutDays } from '@/lib/api';

const listMock = vi.mocked(fetchFundingPayoutDays);

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

const DAYS = [
  '2026-09-20',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
] as const;

const TABLE: FundingPayoutDays = {
  days: [...DAYS],
  rows: [
    {
      accountId: 'acc_ada',
      name: 'Ada',
      days: ['blocked', 'missed', 'paid', 'blocked', 'blocked', 'blocked', 'blocked'],
    },
    {
      accountId: null,
      name: 'ghost',
      days: ['paid', 'blocked', 'blocked', 'blocked', 'blocked', 'blocked', 'blocked'],
    },
    {
      accountId: 'acc_blank',
      name: '',
      days: ['missed', 'blocked', 'blocked', 'blocked', 'blocked', 'blocked', 'blocked'],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue({ days: [...DAYS], rows: [] });
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('FundingPayoutsScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<FundingPayoutsScreen />);
    expect(container.firstChild).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy below moderator and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<FundingPayoutsScreen />);
    expect(screen.getByRole('heading', { name: 'Payout per person' })).toBeTruthy();
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe('/moderate');
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<FundingPayoutsScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows loading copy', () => {
    listMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<FundingPayoutsScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('Nobody was entitled in these seven days.')).toBeNull();
  });

  it('shows empty copy', async () => {
    renderWithLocale(<FundingPayoutsScreen />);
    expect(await screen.findByText('Nobody was entitled in these seven days.')).toBeTruthy();
    expect(listMock).toHaveBeenCalledWith('sess');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the legend, a member link, an unmatched handle, and today on the right', async () => {
    listMock.mockResolvedValue(TABLE);
    renderWithLocale(<FundingPayoutsScreen />);
    expect(await screen.findByRole('table', { name: 'Payout per person' })).toBeTruthy();
    const legend = screen.getByRole('list');
    expect(within(legend).getByText('Not entitled')).toBeTruthy();
    expect(within(legend).getByText('Entitled, not collected')).toBeTruthy();
    expect(within(legend).getByText('Payout received')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe('/members/acc_ada');
    expect(screen.getByRole('rowheader', { name: 'ghost' }).querySelector('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'Unnamed' }).getAttribute('href')).toBe(
      '/members/acc_blank',
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers[headers.length - 1]?.getAttribute('aria-label')).toMatch(/today/);
    expect(screen.getAllByLabelText(/Ada, .+, not entitled/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Ada, .+, entitled, not collected/)).toHaveLength(1);
    expect(screen.getAllByLabelText(/Ada, .+, payout received/)).toHaveLength(1);
  });

  it('shows the error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('down'));
    renderWithLocale(<FundingPayoutsScreen />);
    expect(
      await screen.findByText('Could not load the payout table. Please try again.'),
    ).toBeTruthy();
    listMock.mockResolvedValueOnce({ days: [...DAYS], rows: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nobody was entitled in these seven days.')).toBeTruthy();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale resolve after unmount', async () => {
    let resolveList: ((value: FundingPayoutDays) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const view = renderWithLocale(<FundingPayoutsScreen />);
    view.unmount();
    await act(async () => {
      resolveList?.(TABLE);
      await Promise.resolve();
    });
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('ignores a stale reject after unmount', async () => {
    let rejectList: ((reason: Error) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectList = reject;
        }),
    );
    const view = renderWithLocale(<FundingPayoutsScreen />);
    view.unmount();
    await act(async () => {
      rejectList?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignores a late resolve after the session is cleared', async () => {
    let resolveList: ((value: FundingPayoutDays) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    renderWithLocale(<FundingPayoutsScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
    await act(async () => {
      resolveList?.(TABLE);
      await Promise.resolve();
    });
    expect(screen.queryByRole('table')).toBeNull();
  });
});
