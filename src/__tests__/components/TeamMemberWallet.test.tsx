import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamMemberWallet } from '@/components/TeamMemberWallet';
import { useLatestRateDayState } from '@/hooks/useLatestRateDay';
import type { TeamWallet } from '@/lib/api-types';
import type { FiatRateDay } from '@/lib/stats-money';
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

vi.mock('@/lib/api', () => ({ fetchTeamMemberWallet: vi.fn() }));
vi.mock('@/hooks/useLatestRateDay', () => ({ useLatestRateDayState: vi.fn() }));

import { fetchTeamMemberWallet } from '@/lib/api';

const walletMock = vi.mocked(fetchTeamMemberWallet);

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '60000.00',
  chf: '50000.00',
  eur: '55000.00',
  php: '3400000.00',
};

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

const WALLET: TeamWallet = {
  balance: { balanceSats: 21_000, syncedAt: NOW },
  summary: {
    inSats: 30_000,
    outSats: 10_000,
    feeSats: 12,
    categories: [
      { category: 'member', inSats: 30_000, outSats: 4_000 },
      { category: 'shop', inSats: 0, outSats: 2_000 },
      { category: 'outside_lightning', inSats: 0, outSats: 3_000 },
      { category: 'unknown', inSats: 0, outSats: 1_000 },
      { category: 'gift', inSats: 0, outSats: 0 },
    ],
  },
  payments: [
    {
      id: 'p1',
      direction: 'in',
      status: 'completed',
      amountSats: 30_000,
      feeSats: 0,
      timestamp: NOW - HOUR,
      category: 'member',
      counterpartyAccountId: 'acc_bob',
      counterpartyName: 'Bob',
      description: 'Thanks',
      lnurlComment: null,
    },
    {
      id: 'p2',
      direction: 'out',
      status: 'pending',
      amountSats: 2_000,
      feeSats: 3,
      timestamp: NOW - 2 * HOUR,
      category: 'shop',
      counterpartyAccountId: 'acc_shop',
      counterpartyName: '',
      destination: 'shop@21.gifts',
      lnurlComment: 'Table 4',
    },
    {
      id: 'p3',
      direction: 'out',
      status: 'failed',
      amountSats: 3_000,
      feeSats: null,
      timestamp: NOW - 3 * HOUR,
      category: 'outside_lightning',
      destination: 'carol@example.com',
      description: '',
    },
    {
      id: 'p4',
      direction: 'out',
      status: 'completed',
      amountSats: 1_000,
      timestamp: NOW - 4 * HOUR,
      category: 'unknown',
      counterpartyAccountId: 'acc_dan',
      counterpartyName: null,
      destination: '',
    },
    {
      id: 'p5',
      direction: 'in',
      status: 'completed',
      amountSats: 500,
      timestamp: NOW - 5 * HOUR,
      category: 'unknown',
      counterpartyAccountId: null,
      destination: null,
    },
  ],
  nextCursor: null,
};

const EMPTY: TeamWallet = {
  balance: null,
  summary: { inSats: 0, outSats: 0, feeSats: 0, categories: [] },
  payments: [],
  nextCursor: null,
};

let observers: IntersectionObserverCallback[] = [];

class FakeObserver {
  public constructor(callback: IntersectionObserverCallback) {
    observers.push(callback);
  }
  public observe(): void {}
  public disconnect(): void {}
}

beforeEach(() => {
  vi.clearAllMocks();
  observers = [];
  vi.mocked(useLatestRateDayState).mockReturnValue({ rateDay: RATE_DAY, settled: true });
  walletMock.mockResolvedValue(WALLET);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TeamMemberWallet', () => {
  it('shows the balance, the summary with shares, and the payments with fiat', async () => {
    renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    await screen.findByText('Reported', { exact: false });
    expect(walletMock).toHaveBeenCalledWith('sess', 'acc_1', {
      period: '30',
      category: null,
      direction: null,
      before: null,
    });
    const balance = screen.getByRole('region', { name: 'Balance' });
    expect(balance.textContent).toContain("₿21'000");
    expect(balance.textContent).toContain('·');
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('Spent in the community').nextSibling?.textContent).toBe(
      '60%',
    );
    expect(within(summary).getByText('Spent outside').nextSibling?.textContent).toBe('30%');
    expect(within(summary).getByText('Sent by category')).toBeTruthy();
    expect(within(summary).queryByText('Gift')).toBeNull();
    const list = screen.getByRole('region', { name: 'Payments' });
    expect(within(list).getByRole('link', { name: 'From Bob' }).getAttribute('href')).toBe(
      '/members/acc_bob',
    );
    expect(
      within(list)
        .getAllByRole('link', { name: 'To Unnamed' })
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/members/acc_shop', '/members/acc_dan']);
    expect(within(list).getByText('To carol@example.com')).toBeTruthy();
    expect(within(list).getByText('Thanks')).toBeTruthy();
    expect(within(list).getByText('Table 4')).toBeTruthy();
    expect(list.textContent).toContain('Sent · Shop · Pending');
    expect(list.textContent).toContain('Sent · Outside 21.gifts · Failed');
    expect(list.textContent).toContain('Received · Member');
    expect(within(list).getAllByText('Fee', { exact: false })).toHaveLength(1);
    expect(list.textContent).toContain("₿30'000");
  });

  it('says when the wallet has not reported and nothing was sent', async () => {
    walletMock.mockResolvedValue(EMPTY);
    renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    await screen.findByText("This member's wallet has not reported yet.");
    expect(screen.getByText('Nothing sent in this period.')).toBeTruthy();
    expect(screen.getByText('No payments in this period.')).toBeTruthy();
  });

  it('asks again for each period, direction, and category', async () => {
    renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    await screen.findByText('Reported', { exact: false });
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    await waitFor(() =>
      expect(walletMock).toHaveBeenLastCalledWith('sess', 'acc_1', {
        period: '7',
        category: null,
        direction: null,
        before: null,
      }),
    );
    fireEvent.click(within(screen.getByRole('group', { name: 'Direction' })).getByText('Sent'));
    await waitFor(() =>
      expect(walletMock).toHaveBeenLastCalledWith('sess', 'acc_1', {
        period: '7',
        category: null,
        direction: 'out',
        before: null,
      }),
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByRole('option', { name: 'Shop' }));
    await waitFor(() =>
      expect(walletMock).toHaveBeenLastCalledWith('sess', 'acc_1', {
        period: '7',
        category: 'shop',
        direction: 'out',
        before: null,
      }),
    );
  });

  it('shows the error and tries again', async () => {
    walletMock.mockRejectedValueOnce(new Error('down'));
    renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    await screen.findByText('Could not load the wallet data. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Reported', { exact: false });
  });

  it('keeps the list when the next page fails and loads it on Try again', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    walletMock
      .mockResolvedValueOnce({ ...WALLET, nextCursor: 'c1' })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ...EMPTY, payments: [], nextCursor: null });
    renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    await screen.findByText('Reported', { exact: false });
    act(() => {
      observers[observers.length - 1]?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    await screen.findByText('Could not load the wallet data. Please try again.');
    expect(screen.getByText('Thanks')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.queryByText('Could not load the wallet data. Please try again.')).toBeNull(),
    );
    expect(walletMock).toHaveBeenLastCalledWith('sess', 'acc_1', {
      period: '30',
      category: null,
      direction: null,
      before: 'c1',
    });
  });

  it('keeps Loading until the rate settles, then shows the amounts', async () => {
    vi.mocked(useLatestRateDayState).mockReturnValue({ rateDay: null, settled: false });
    const view = renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    await waitFor(() => expect(walletMock).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Balance' })).toBeNull();
    vi.mocked(useLatestRateDayState).mockReturnValue({ rateDay: null, settled: true });
    view.rerender(<TeamMemberWallet session="sess" accountId="acc_1" />);
    expect(screen.getByRole('region', { name: 'Balance' }).textContent).toContain("₿21'000");
    expect(screen.getByRole('region', { name: 'Balance' }).textContent).not.toContain('·');
  });

  it('uses the Sent total for the shares and says nothing was sent only when it is zero', async () => {
    walletMock.mockResolvedValue({
      ...EMPTY,
      summary: { inSats: 0, outSats: 500, feeSats: 0, categories: [] },
    });
    renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    const summary = await screen.findByRole('region', { name: 'Summary' });
    expect(within(summary).queryByText('Nothing sent in this period.')).toBeNull();
    expect(within(summary).getByText('Spent in the community').nextSibling?.textContent).toBe('0%');
  });

  it('loads on when a page without payments still has a next page', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    walletMock
      .mockResolvedValueOnce({ ...EMPTY, nextCursor: 'c1' })
      .mockResolvedValueOnce({ ...EMPTY, payments: WALLET.payments.slice(0, 1) });
    renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    await screen.findByText("This member's wallet has not reported yet.");
    expect(screen.queryByText('No payments in this period.')).toBeNull();
    act(() => {
      observers[observers.length - 1]?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    await screen.findByText('Thanks');
  });

  it('shows the forbidden sentence on 403', async () => {
    walletMock.mockResolvedValue(null);
    renderWithLocale(<TeamMemberWallet session="sess" accountId="acc_1" />);
    await screen.findByText('This page is for moderators.');
    expect(screen.queryByRole('region', { name: 'Payments' })).toBeNull();
  });
});
