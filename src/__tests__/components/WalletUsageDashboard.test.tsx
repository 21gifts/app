import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletUsageDashboard } from '@/components/WalletUsageDashboard';
import { useSpotRate } from '@/hooks/useSpotRate';
import type {
  WalletParty,
  WalletPurpose,
  WalletStats,
  WalletUsage,
  WalletUsageDay,
  WalletUsageFlow,
} from '@/lib/api-types';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useSpotRate', () => ({
  useSpotRate: vi.fn(),
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const ZERO = { count: 0, sats: 0 };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function usageDay(
  day: string,
  activeWalletCount: number,
  forum: { count: number; sats: number },
  deposit: { count: number; sats: number },
): WalletUsageDay {
  return {
    day,
    purposes: {
      deposit,
      withdrawal: ZERO,
      shop_purchase: ZERO,
      forum_gift: forum,
      transfer: ZERO,
      fund_deposit: ZERO,
      fund_payout: ZERO,
      other: ZERO,
    },
    activeWalletCount,
    sendingWalletCount: 1,
    receivingWalletCount: 1,
  };
}

function chooseDay(name: string): void {
  fireEvent.click(screen.getByRole('combobox', { name: 'Day' }));
  fireEvent.click(screen.getByRole('option', { name }));
}

function flow(
  day: string,
  from: WalletParty,
  to: WalletParty,
  purpose: WalletPurpose,
  count: number,
  sats: number,
  feeSats: number,
): WalletUsageFlow {
  return { day, from, to, purpose, count, sats, feeSats };
}

const BASE: WalletUsage = {
  releasedAt: '2026-11-09T11:17:00.000Z',
  asOf: '2026-11-12T08:00:00.000Z',
  totals: {
    paymentCount: 9,
    volumeSats: 100000,
    feeSats: 10,
    medianSats: 10,
    averageSats: 2.5,
    activeWalletCount: 4,
    sendingWalletCount: 3,
    topFiveSenderShare: 0.5,
    heartCount: 1,
    paidShopChargeCount: 6,
  },
  days: [
    usageDay('2026-11-10', 0, ZERO, { count: 1, sats: 50 }),
    usageDay('2026-11-09', 5, { count: 2, sats: 100 }, ZERO),
  ],
  flows: [
    flow('2026-11-09', 'outside', 'fund', 'deposit', 1, 1000, 0),
    flow('2026-11-09', 'outside', 'members', 'deposit', 1, 500, 0),
    flow('2026-11-10', 'outside', 'members', 'deposit', 1, 40, 0),
    flow('2026-11-09', 'members', 'members', 'shop_purchase', 2, 200, 0),
    flow('2026-11-09', 'members', 'members', 'forum_gift', 2, 100, 0),
    flow('2026-11-10', 'members', 'members', 'forum_gift', 1, 0, 0),
    flow('2026-11-09', 'members', 'fund', 'fund_deposit', 1, 300, 0),
    flow('2026-11-09', 'fund', 'members', 'fund_payout', 1, 100, 0),
    flow('2026-11-10', 'members', 'outside', 'withdrawal', 1, 50, 10),
    flow('2026-11-09', 'platform', 'fund', 'other', 0, 0, 0),
  ],
  amountBuckets: [
    { key: '101-1k', minSats: 101, maxSats: 1000, count: 2, sats: 200 },
    { key: '1', minSats: 1, maxSats: 1, count: 5, sats: 5 },
  ],
  hours: [
    { hourUtc: 16, count: 2 },
    { hourUtc: 0, count: 1 },
    { hourUtc: 0, count: 3 },
    { hourUtc: 1, count: 4 },
  ],
  forum: [
    { day: '2026-11-08', gifts: 2, hearts: 0, sats: 20 },
    { day: '2026-11-09', gifts: 0, hearts: 0, sats: 0 },
    { day: '2026-11-10', gifts: 0, hearts: 4, sats: 40 },
    { day: '2026-11-11', gifts: 6, hearts: 0, sats: 60 },
    { day: '2026-11-12', gifts: 2, hearts: 2, sats: 40 },
  ],
  shopCharges: [
    { day: '2026-10-01', created: 2, paid: 0 },
    { day: '2026-10-02', created: 0, paid: 5 },
    { day: '2026-11-09', created: 1, paid: 1 },
    { day: '2026-11-10', created: 0, paid: 0 },
  ],
};

const WALLETS: WalletStats = {
  walletCount: 10,
  fundedWalletCount: 7,
  totalSats: 20,
  totalBtc: '0.00000020',
  asOf: '2026-11-12T08:00:00.000Z',
  balanceOverTime: [
    {
      day: '2026-11-08',
      totalSats: 1,
      totalBtc: '0.00000001',
      walletCount: 1,
      fundedWalletCount: 1,
    },
    {
      day: '2026-11-09',
      totalSats: 4,
      totalBtc: '0.00000004',
      walletCount: 4,
      fundedWalletCount: 4,
    },
    {
      day: '2026-11-10',
      totalSats: 0,
      totalBtc: '0.00000000',
      walletCount: 4,
      fundedWalletCount: 0,
    },
    {
      day: '2026-11-11',
      totalSats: 2,
      totalBtc: '0.00000002',
      walletCount: 5,
      fundedWalletCount: 2,
    },
  ],
};

function usageWith(overrides: Partial<WalletUsage>): WalletUsage {
  return { ...BASE, ...overrides };
}

function show(
  usage: WalletUsage | null,
  wallets: WalletStats | null,
  error: string | null,
  loading: boolean,
): void {
  renderWithLocale(
    <WalletUsageDashboard usage={usage} wallets={wallets} error={error} loading={loading} />,
  );
}

function chartTitles(testId: string): (string | null)[] {
  return [...screen.getByTestId(testId).querySelectorAll('title')].map((node) => node.textContent);
}

function purposeTitles(): (string | null)[] {
  return chartTitles('purpose-chart');
}

function forumTitles(): (string | null)[] {
  return chartTitles('forum-chart');
}

function sizeTitles(): (string | null)[] {
  return chartTitles('size-chart');
}

const WALLET_INNER_W = 800 - 96 - 16;

function balancePoint(
  day: string,
  fundedWalletCount: number,
): WalletStats['balanceOverTime'][number] {
  return {
    day,
    totalSats: fundedWalletCount,
    totalBtc: '0.00000000',
    walletCount: fundedWalletCount,
    fundedWalletCount,
  };
}

function activeBarBoxes(): { x: number; width: number; height: number }[] {
  const region = screen.getByRole('region', { name: 'Wallets per day' });
  return [...region.querySelectorAll('[data-testid="wallet-active-bars"] rect')].map((rect) => {
    const x = rect.getAttribute('x');
    const width = rect.getAttribute('width');
    const height = rect.getAttribute('height');
    if (x === null || width === null || height === null) {
      throw new Error('missing bar geometry');
    }
    return { x: Number(x), width: Number(width), height: Number(height) };
  });
}

beforeEach(() => {
  vi.mocked(useSpotRate).mockReset().mockReturnValue(RATE_DAY);
});

afterEach(cleanup);

describe('WalletUsageDashboard', () => {
  it('shows the release figures, charts, and both flow modes', () => {
    show(BASE, WALLETS, null, false);
    expect(useSpotRate).toHaveBeenCalledWith(true);
    expect(
      screen.getByText('Released 9 November 2026, 11:17 UTC. As of 12 November 2026, 08:00 UTC.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '9 payments since the release, from 4 active wallets. The forum is paid 2 times as often per day as in the 28 days before.',
      ),
    ).toBeTruthy();
    expect(screen.getByText("\u20bf100'000")).toBeTruthy();
    expect(screen.getByText('$100.00')).toBeTruthy();
    expect(screen.getByText('7 with a balance')).toBeTruthy();
    expect(screen.getByText('3 sending')).toBeTruthy();
    expect(screen.getByText('3.5 after \u00b7 2 before')).toBeTruthy();
    expect(screen.getByText("\u20bf1'200")).toBeTruthy();
    expect(screen.getByText('$1.20')).toBeTruthy();
    expect(screen.getAllByText('Deposit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Forum gifts & hearts').length).toBeGreaterThan(0);
    const purpose = screen.getByRole('heading', {
      name: 'Payments per day by purpose',
    }).parentElement;
    if (purpose === null) {
      throw new Error('missing purpose section');
    }
    const legend = within(purpose).getByRole('list');
    expect(within(legend).queryByText('Withdrawal')).toBeNull();
    expect(screen.getAllByTestId('release-line')).toHaveLength(2);
    const hours = [...screen.getByTestId('manila-chart').querySelectorAll('title')].map(
      (node) => node.textContent,
    );
    const manila = Array.from({ length: 24 }, (_, hour) => `${hour}: 0`);
    manila[0] = '0: 2';
    manila[8] = '8: 4';
    manila[9] = '9: 4';
    expect(hours).toEqual(manila);
    const wallets = screen.getByRole('region', { name: 'Wallets per day' });
    const titles = [...wallets.querySelectorAll('title')].map((node) => node.textContent);
    expect(titles).toContain('2026-11-09: 4 with a balance · 5 active');
    expect(titles).toContain('2026-11-10: 0 with a balance · 0 active');
    expect(titles).toContain('2026-11-11: 2 with a balance');
    expect(wallets.querySelectorAll('[data-testid="wallet-active-bars"] rect')).toHaveLength(1);
    expect(wallets.querySelectorAll('circle')).toHaveLength(2);
    expect(purposeTitles()).toEqual([
      '2026-11-09: Deposit: 0 / \u20bf0 · $0.00, Forum gifts & hearts: 2 / \u20bf100 · $0.10',
      '2026-11-10: Deposit: 1 / \u20bf50 · $0.05, Forum gifts & hearts: 0 / \u20bf0 · $0.00',
    ]);
    expect(forumTitles()).toEqual([
      '2026-11-08: 2 gifts, 0 hearts, \u20bf20 · $0.02',
      '2026-11-09: 0 gifts, 0 hearts, \u20bf0 · $0.00',
      '2026-11-10: 0 gifts, 4 hearts, \u20bf40 · $0.04',
      '2026-11-11: 6 gifts, 0 hearts, \u20bf60 · $0.06',
      '2026-11-12: 2 gifts, 2 hearts, \u20bf40 · $0.04',
    ]);
    expect(sizeTitles()).toEqual(['1: \u20bf5 · $0.01', '101-1k: \u20bf200 · $0.20']);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain("\u20bf1'000 · $1.00");
    expect(table.textContent).toContain('\u20bf540 · $0.54');
    expect(table.textContent).toContain('\u20bf10 · $0.01');
    const withdrawalRow = within(table).getByText('Withdrawal').closest('tr');
    if (withdrawalRow === null) {
      throw new Error('missing withdrawal row');
    }
    expect(withdrawalRow.textContent).toContain('Members');
    expect(withdrawalRow.textContent).toContain('Outside');
    expect(withdrawalRow.textContent).toContain('\u20bf50 · $0.05');
    expect(within(table).queryByText('Other')).toBeNull();
    expect(screen.getByText(/Wallet payments are counted once/)).toBeTruthy();
    const fund = screen.getByRole('img', { name: 'Tondo fund' });
    expect(fund.querySelector('[data-flow="Deposits from outside"]')).toBeTruthy();
    expect(fund.querySelector('[data-flow="Balance at start of day"]')).toBeNull();
    expect(fund.querySelector('[data-flow="Balance at end of day"]')).toBeTruthy();
    const fundFrame = fund.parentElement;
    const depositRibbon = fund.querySelector('[data-flow="Deposits from outside"]');
    const endRibbon = fund.querySelector('[data-flow="Balance at end of day"]');
    if (fundFrame === null || depositRibbon === null || endRibbon === null) {
      throw new Error('missing fund ribbon');
    }
    fireEvent.mouseEnter(depositRibbon);
    expect(fundFrame.querySelector('[role="status"]')?.textContent).toBe(
      "Deposits from outside: 1 payments · \u20bf1'000 · $1.00",
    );
    fireEvent.mouseEnter(endRibbon);
    expect(fundFrame.querySelector('[role="status"]')?.textContent).toBe(
      "Balance at end of day: \u20bf1'200 · $1.20",
    );
    expect(
      screen.getByRole('img', { name: 'Member wallets' }).querySelector('[data-flow="Fees"]'),
    ).toBeTruthy();

    const dayMenu = screen.getByRole('combobox', { name: 'Day' });
    expect(dayMenu.getAttribute('data-value')).toBe('');
    expect(dayMenu.parentElement?.parentElement?.className).toContain('scheme-light');
    expect(dayMenu.parentElement?.parentElement?.className).toContain('text-ink');
    chooseDay('2026-11-10');
    expect(screen.getByRole('combobox', { name: 'Day' }).getAttribute('data-value')).toBe(
      '2026-11-10',
    );
    const fundDay = screen.getByRole('img', { name: 'Tondo fund' });
    expect(fundDay.querySelector('[data-flow="Deposits from outside"]')).toBeNull();
    expect(fundDay.querySelector('[data-flow="Balance at start of day"]')).toBeTruthy();
    expect(
      screen
        .getByRole('img', { name: 'Member wallets' })
        .querySelector('[data-flow="Forum gifts from members"]'),
    ).toBeNull();
    chooseDay('All days');
    expect(screen.getByRole('combobox', { name: 'Day' }).getAttribute('data-value')).toBe('');
    expect(
      screen
        .getByRole('img', { name: 'Tondo fund' })
        .querySelector('[data-flow="Balance at start of day"]'),
    ).toBeNull();
    expect(screen.getByRole('table').textContent).toContain("\u20bf1'000");

    fireEvent.click(screen.getByRole('button', { name: 'Count' }));
    const members = screen.getByRole('img', { name: 'Member wallets' });
    expect(members.querySelector('[data-flow="Forum gifts from members"]')).toBeTruthy();
    expect(members.querySelector('[data-flow="Fees"]')).toBeNull();
    expect(members.querySelector('[data-flow="Balance at end of day"]')).toBeNull();
  });

  it('names every month and both clock widths', () => {
    for (const [index, name] of MONTHS.entries()) {
      const month = String(index + 1).padStart(2, '0');
      show(usageWith({ releasedAt: `2026-${month}-15T12:30:00.000Z` }), null, null, false);
      expect(
        screen.getByText(`Released 15 ${name} 2026, 12:30 UTC.`, { exact: false }),
      ).toBeTruthy();
      cleanup();
    }
  });

  it('throws when the calendar month is outside 0 through 11', () => {
    const month = vi.spyOn(Date.prototype, 'getUTCMonth').mockReturnValue(12);
    try {
      expect(() => show(BASE, null, null, false)).toThrow(/Invalid month/);
    } finally {
      month.mockRestore();
    }
  });

  it('collapses one day, one Manila hour, and a single wallet point', () => {
    show(
      usageWith({
        days: [usageDay('2026-11-09', 0, ZERO, { count: 1, sats: 1 })],
        forum: [{ day: '2026-11-09', gifts: 1, hearts: 0, sats: 1 }],
        shopCharges: [{ day: '2026-11-09', created: 1, paid: 0 }],
        amountBuckets: [{ key: '1', minSats: 1, maxSats: 1, count: 1, sats: 1 }],
        hours: [
          { hourUtc: 0, count: 2 },
          { hourUtc: 0, count: 3 },
        ],
        flows: [],
      }),
      {
        ...WALLETS,
        balanceOverTime: [
          {
            day: '2026-11-09',
            totalSats: 0,
            totalBtc: '0.00000000',
            walletCount: 1,
            fundedWalletCount: 0,
          },
        ],
      },
      null,
      false,
    );
    expect(screen.getByText('9 payments since the release, from 4 active wallets.')).toBeTruthy();
    expect(screen.queryByText(/times as often/)).toBeNull();
    expect(screen.getByText('\u2014')).toBeTruthy();
    const oneHour = Array.from({ length: 24 }, (_, hour) => `${hour}: 0`);
    oneHour[8] = '8: 5';
    expect(
      [...screen.getByTestId('manila-chart').querySelectorAll('title')].map(
        (node) => node.textContent,
      ),
    ).toEqual(oneHour);
    const wallets = screen.getByRole('region', { name: 'Wallets per day' });
    expect([...wallets.querySelectorAll('title')].map((node) => node.textContent)).toContain(
      '2026-11-09: 0 with a balance · 0 active',
    );
    expect(wallets.querySelectorAll('[data-testid="wallet-active-bars"] rect')).toHaveLength(0);
    expect(wallets.querySelectorAll('circle')).toHaveLength(0);
    expect(screen.getAllByText('No payments on this day')).toHaveLength(2);
  });

  it('centers the active-wallet bar when only one day has wallets', () => {
    show(
      usageWith({
        days: [usageDay('2026-11-09', 4, ZERO, ZERO)],
        flows: [],
      }),
      {
        ...WALLETS,
        balanceOverTime: [balancePoint('2026-11-09', 2)],
      },
      null,
      false,
    );
    const wallets = screen.getByRole('region', { name: 'Wallets per day' });
    expect([...wallets.querySelectorAll('title')].map((node) => node.textContent)).toContain(
      '2026-11-09: 2 with a balance · 4 active',
    );
    const [bar] = activeBarBoxes();
    if (bar === undefined) {
      throw new Error('missing active bar');
    }
    expect(activeBarBoxes()).toHaveLength(1);
    expect(bar.height).toBeGreaterThan(0);
    expect(bar.width).toBeCloseTo(WALLET_INNER_W * 0.2, 5);
    expect(bar.x + bar.width / 2).toBeCloseTo(96 + WALLET_INNER_W / 2, 5);
  });

  it('spaces active-wallet bars across several days', () => {
    show(
      usageWith({
        days: [usageDay('2026-11-09', 4, ZERO, ZERO), usageDay('2026-11-10', 2, ZERO, ZERO)],
        flows: [],
      }),
      {
        ...WALLETS,
        balanceOverTime: [balancePoint('2026-11-09', 3), balancePoint('2026-11-10', 5)],
      },
      null,
      false,
    );
    const wallets = screen.getByRole('region', { name: 'Wallets per day' });
    const titles = [...wallets.querySelectorAll('title')].map((node) => node.textContent);
    expect(titles).toContain('2026-11-09: 3 with a balance · 4 active');
    expect(titles).toContain('2026-11-10: 5 with a balance · 2 active');
    const [first, second] = activeBarBoxes();
    if (first === undefined || second === undefined) {
      throw new Error('missing active bars');
    }
    const step = WALLET_INNER_W;
    const barW = step * 0.45;
    expect(activeBarBoxes()).toHaveLength(2);
    expect(first.width).toBeCloseTo(barW, 5);
    expect(second.width).toBeCloseTo(barW, 5);
    expect(first.x + first.width / 2).toBeCloseTo(96, 5);
    expect(second.x + second.width / 2).toBeCloseTo(96 + WALLET_INNER_W, 5);
    expect(first.height).toBeCloseTo(second.height * 2, 5);
  });

  it('hides wallets per day when every balance day is before the release', () => {
    show(
      BASE,
      {
        ...WALLETS,
        balanceOverTime: [
          {
            day: '2026-11-08',
            totalSats: 1,
            totalBtc: '0.00000001',
            walletCount: 1,
            fundedWalletCount: 1,
          },
        ],
      },
      null,
      false,
    );
    expect(screen.queryByRole('region', { name: 'Wallets per day' })).toBeNull();
    expect(screen.getByText('7 with a balance')).toBeTruthy();
  });

  it('shows a raw timestamp and drops the release line when the time does not parse', () => {
    show(usageWith({ releasedAt: 'not-a-date', asOf: 'still-not-a-time' }), WALLETS, null, false);
    expect(screen.getByText('not-a-date still-not-a-time')).toBeTruthy();
    expect(screen.queryByText(/times as often/)).toBeNull();
    expect(screen.getByText('\u2014')).toBeTruthy();
    expect(screen.queryByTestId('release-line')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Wallets per day' })).toBeNull();
  });

  it('says when the payload has no as-of time', () => {
    show(usageWith({ asOf: null }), WALLETS, null, false);
    expect(screen.getByText(/Figures have no as-of time/)).toBeTruthy();
  });

  it('says the forum had no earlier payments when that pace is zero', () => {
    show(
      usageWith({
        forum: [
          { day: '2026-11-08', gifts: 0, hearts: 0, sats: 0 },
          { day: '2026-11-09', gifts: 4, hearts: 0, sats: 1 },
        ],
      }),
      null,
      null,
      false,
    );
    expect(screen.getByText(/The forum had no payments per day before the release/)).toBeTruthy();
    expect(screen.getByText('4 after \u00b7 0 before')).toBeTruthy();
  });

  it('omits the pace when the forum series is only before the release', () => {
    show(
      usageWith({
        forum: [{ day: '2026-11-01', gifts: 2, hearts: 1, sats: 1 }],
      }),
      null,
      null,
      false,
    );
    expect(screen.getByText('9 payments since the release, from 4 active wallets.')).toBeTruthy();
    expect(screen.queryByText(/times as often/)).toBeNull();
    expect(screen.queryByText(/had no payments/)).toBeNull();
    expect(screen.getByText('\u2014')).toBeTruthy();
  });

  it('draws empty charts and a zero fund when the series are empty', () => {
    show(
      usageWith({
        days: [],
        flows: [],
        amountBuckets: [],
        hours: [],
        forum: [],
        shopCharges: [],
      }),
      null,
      null,
      false,
    );
    expect(screen.getByTestId('purpose-chart').querySelectorAll('rect')).toHaveLength(0);
    expect(screen.getByTestId('forum-chart').querySelectorAll('rect')).toHaveLength(0);
    expect(screen.getByTestId('shop-chart').querySelectorAll('rect')).toHaveLength(0);
    expect(screen.getByTestId('size-chart').querySelectorAll('rect')).toHaveLength(0);
    const quietHours = Array.from({ length: 24 }, (_, hour) => `${hour}: 0`);
    expect(screen.getByTestId('manila-chart').querySelectorAll('rect')).toHaveLength(24);
    expect(
      [...screen.getByTestId('manila-chart').querySelectorAll('title')].map(
        (node) => node.textContent,
      ),
    ).toEqual(quietHours);
    expect(screen.getAllByText('No payments on this day')).toHaveLength(2);
    expect(screen.queryByText('with a balance')).toBeNull();
    expect(screen.getByText('3 sending')).toBeTruthy();
    expect(screen.getByText('\u20bf0')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Wallets per day' })).toBeNull();
  });

  it('shows bitcoin alone when there is no spot', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    show(BASE, WALLETS, null, false);
    expect(screen.getByText("\u20bf100'000")).toBeTruthy();
    expect(screen.queryByText('$100.00')).toBeNull();
    expect(screen.queryByText('$1.20')).toBeNull();
    expect(purposeTitles()).toEqual([
      '2026-11-09: Deposit: 0 / \u20bf0, Forum gifts & hearts: 2 / \u20bf100',
      '2026-11-10: Deposit: 1 / \u20bf50, Forum gifts & hearts: 0 / \u20bf0',
    ]);
    expect(forumTitles()).toEqual([
      '2026-11-08: 2 gifts, 0 hearts, \u20bf20',
      '2026-11-09: 0 gifts, 0 hearts, \u20bf0',
      '2026-11-10: 0 gifts, 4 hearts, \u20bf40',
      '2026-11-11: 6 gifts, 0 hearts, \u20bf60',
      '2026-11-12: 2 gifts, 2 hearts, \u20bf40',
    ]);
    expect(sizeTitles()).toEqual(['1: \u20bf5', '101-1k: \u20bf200']);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain("\u20bf1'000");
    expect(table.textContent).not.toContain('$');
    const fund = screen.getByRole('img', { name: 'Tondo fund' });
    const frame = fund.parentElement;
    const ribbon = fund.querySelector('[data-flow="Deposits from outside"]');
    if (frame === null || ribbon === null) {
      throw new Error('missing fund ribbon');
    }
    fireEvent.mouseEnter(ribbon);
    expect(frame.querySelector('[role="status"]')?.textContent).toBe(
      "Deposits from outside: 1 payments · \u20bf1'000",
    );
  });

  it('keeps a negative Tondo fund balance and shows the fiat with the same minus', () => {
    show(
      usageWith({
        days: [usageDay('2026-11-09', 1, ZERO, ZERO)],
        flows: [
          flow('2026-11-09', 'outside', 'fund', 'deposit', 1, 100, 0),
          flow('2026-11-09', 'fund', 'members', 'fund_payout', 1, 500, 0),
        ],
      }),
      null,
      null,
      false,
    );
    const label = screen.getByText('Tondo fund balance');
    const tile = label.parentElement;
    if (tile === null) {
      throw new Error('missing fund tile');
    }
    expect(tile.textContent).toContain('\u2212\u20bf400');
    expect(tile.textContent).toContain('\u2212$0.40');
    expect(screen.getByText('$100.00')).toBeTruthy();
    const fund = screen.getByRole('img', { name: 'Tondo fund' });
    const frame = fund.parentElement;
    const ribbon = fund.querySelector('[data-flow="Balance below zero at end of day"]');
    if (frame === null || ribbon === null) {
      throw new Error('missing balance ribbon');
    }
    fireEvent.mouseEnter(ribbon);
    expect(frame.querySelector('[role="status"]')?.textContent).toBe(
      'Balance below zero at end of day: \u2212\u20bf400 · \u2212$0.40',
    );
  });

  it('keeps the first copy of a duplicated day and ignores flows from other days', () => {
    show(
      usageWith({
        days: [
          usageDay('2026-11-10', 1, ZERO, { count: 1, sats: 10 }),
          usageDay('2026-11-09', 4, ZERO, { count: 1, sats: 100 }),
          usageDay('2026-11-09', 9, { count: 3, sats: 999 }, ZERO),
        ],
        flows: [
          flow('2026-11-09', 'outside', 'fund', 'deposit', 1, 100, 0),
          flow('2026-11-08', 'outside', 'fund', 'deposit', 1, 5000, 0),
        ],
      }),
      WALLETS,
      null,
      false,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Day' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All days',
      '2026-11-09',
      '2026-11-10',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'All days' }));
    const label = screen.getByText('Tondo fund balance');
    const tile = label.parentElement;
    if (tile === null) {
      throw new Error('missing fund tile');
    }
    expect(tile.textContent).toContain('\u20bf100');
    expect(tile.textContent).not.toContain('\u20bf200');
    expect(tile.textContent).not.toContain("5'000");
    const fund = screen.getByRole('img', { name: 'Tondo fund' });
    const deposit = fund.querySelector('[data-flow="Deposits from outside"] [data-metric]');
    if (deposit === null) {
      throw new Error('missing deposit ribbon');
    }
    expect(deposit.getAttribute('data-metric')).toBe('100');
    const endBalance = fund.querySelector('[data-flow="Balance at end of day"] [data-metric]');
    if (endBalance === null) {
      throw new Error('missing end balance');
    }
    expect(endBalance.getAttribute('data-metric')).toBe('100');
    expect(purposeTitles()).toEqual([
      '2026-11-09: Deposit: 1 / \u20bf100 · $0.10',
      '2026-11-10: Deposit: 1 / \u20bf10 · $0.01',
    ]);
    const wallets = screen.getByRole('region', { name: 'Wallets per day' });
    const activeTitles = [...wallets.querySelectorAll('title')].map((node) => node.textContent);
    expect(activeTitles).toContain('2026-11-09: 4 with a balance · 4 active');
    expect(activeTitles).toContain('2026-11-10: 0 with a balance · 1 active');
    expect(activeTitles.join('\n')).not.toContain('9 active');
  });

  it('shows the loading line only while usage is still missing', () => {
    show(null, null, null, true);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(useSpotRate).toHaveBeenCalledWith(false);
  });

  it('keeps the figures when loading is still true after usage arrived', () => {
    show(BASE, null, null, true);
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Payments per day by purpose' })).toBeTruthy();
  });

  it('shows the error line when loading and usage are both empty', () => {
    show(null, null, 'Usage failed.', true);
    expect(screen.getByText('Usage failed.')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('shows the error line without a retry', () => {
    show(null, null, 'Could not load wallet usage. Please try again.', false);
    expect(screen.getByText('Could not load wallet usage. Please try again.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('keeps loaded usage when an error string is also set', () => {
    show(BASE, WALLETS, 'Usage failed.', false);
    expect(screen.queryByText('Usage failed.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Payments per day by purpose' })).toBeTruthy();
  });

  it('shows the loading line when nothing has started', () => {
    show(null, null, null, false);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(useSpotRate).toHaveBeenCalledWith(false);
  });
});
