import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountBalances, WalletFlowDiagram } from '@/components/WalletFlowDiagram';
import type { WalletParty, WalletPurpose, WalletUsageFlow } from '@/lib/api-types';

afterEach(cleanup);

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

function metricOf(root: Element, label: string): string {
  const node = root.querySelector(`[data-flow="${label}"]`);
  if (node === null) {
    throw new Error(`missing ${label}`);
  }
  const path = node.querySelector('[data-metric]');
  if (path === null) {
    throw new Error(`missing path ${label}`);
  }
  const metric = path.getAttribute('data-metric');
  if (metric === null) {
    throw new Error(`missing metric ${label}`);
  }
  return metric;
}

function requireFlow(root: Element, label: string): Element {
  const node = root.querySelector(`[data-flow="${label}"]`);
  if (node === null) {
    throw new Error(`missing ${label}`);
  }
  return node;
}

function pathNumbers(node: Element): number[] {
  const path = node.querySelector('path');
  if (path === null) {
    throw new Error('missing path');
  }
  const d = path.getAttribute('d');
  if (d === null) {
    throw new Error('missing path d');
  }
  const numbers = d.match(/-?\d+(?:\.\d+)?/g);
  if (numbers === null) {
    throw new Error('missing path numbers');
  }
  return numbers.map((value) => Number(value));
}

/** Ribbon thickness taken from the drawn path, not from `data-metric`. */
function ribbonThickness(root: Element, label: string): number {
  const numbers = pathNumbers(requireFlow(root, label));
  const top = numbers[7];
  const bottom = numbers[9];
  if (top === undefined || bottom === undefined) {
    throw new Error(`short path ${label}`);
  }
  return bottom - top;
}

function columnMetric(root: Element, side: 'from' | 'to'): number {
  const nodes = root.querySelectorAll(`[data-side="${side}"] [data-metric]`);
  let total = 0;
  for (const node of nodes) {
    const metric = node.getAttribute('data-metric');
    if (metric === null) {
      throw new Error('missing metric');
    }
    total += Number(metric);
  }
  return total;
}

function columnThickness(root: Element, side: 'from' | 'to'): number {
  const nodes = root.querySelectorAll(`[data-side="${side}"]`);
  let total = 0;
  for (const node of nodes) {
    const numbers = pathNumbers(node);
    const top = numbers[7];
    const bottom = numbers[9];
    if (top === undefined || bottom === undefined) {
      throw new Error('short path');
    }
    total += bottom - top;
  }
  return total;
}

const DAYS = [
  { day: '2026-11-09' },
  { day: '2026-11-10' },
  { day: '2026-11-11' },
  { day: '2026-11-12' },
];

const LEDGER: WalletUsageFlow[] = [
  flow('2026-11-09', 'outside', 'fund', 'deposit', 1, 293955, 0),
  flow('2026-11-09', 'outside', 'members', 'deposit', 8, 120000, 0),
  flow('2026-11-09', 'members', 'members', 'shop_purchase', 20, 70000, 50),
  flow('2026-11-09', 'members', 'members', 'forum_gift', 100, 12000, 0),
  flow('2026-11-09', 'members', 'members', 'transfer', 1, 2000, 0),
  flow('2026-11-09', 'members', 'fund', 'fund_deposit', 1, 280500, 0),
  flow('2026-11-09', 'fund', 'members', 'fund_payout', 30, 69121, 0),
  flow('2026-11-10', 'outside', 'members', 'deposit', 8, 110000, 0),
  flow('2026-11-10', 'members', 'outside', 'withdrawal', 1, 20000, 70),
  flow('2026-11-10', 'members', 'members', 'shop_purchase', 22, 72000, 0),
  flow('2026-11-10', 'members', 'members', 'forum_gift', 102, 13000, 0),
  flow('2026-11-10', 'members', 'members', 'transfer', 2, 3000, 0),
  flow('2026-11-10', 'fund', 'members', 'fund_payout', 31, 69122, 0),
  flow('2026-11-11', 'outside', 'fund', 'deposit', 1, 27088, 0),
  flow('2026-11-11', 'outside', 'members', 'deposit', 7, 120705, 0),
  flow('2026-11-11', 'members', 'outside', 'withdrawal', 1, 25000, 70),
  flow('2026-11-11', 'members', 'members', 'shop_purchase', 22, 74439, 0),
  flow('2026-11-11', 'members', 'members', 'forum_gift', 102, 13465, 0),
  flow('2026-11-11', 'members', 'members', 'transfer', 2, 4000, 0),
  flow('2026-11-11', 'fund', 'members', 'fund_payout', 31, 69121, 0),
  flow('2026-11-12', 'outside', 'members', 'deposit', 7, 121000, 0),
  flow('2026-11-12', 'members', 'outside', 'withdrawal', 1, 24130, 75),
  flow('2026-11-12', 'members', 'members', 'shop_purchase', 24, 75000, 0),
  flow('2026-11-12', 'members', 'members', 'forum_gift', 103, 14000, 0),
  flow('2026-11-12', 'members', 'members', 'transfer', 1, 3321, 0),
  flow('2026-11-12', 'members', 'fund', 'fund_deposit', 1, 100000, 0),
  flow('2026-11-12', 'fund', 'members', 'fund_payout', 31, 69122, 0),
  flow('2026-11-01', 'outside', 'fund', 'deposit', 1, 999999, 0),
];

const PARTIES: readonly WalletParty[] = ['outside', 'members', 'fund', 'platform'];
const PURPOSES: readonly WalletPurpose[] = [
  'deposit',
  'withdrawal',
  'shop_purchase',
  'forum_gift',
  'transfer',
  'fund_deposit',
  'fund_payout',
  'other',
];

const MEMBER_FROM = [
  'Deposits from outside',
  'Deposits from members',
  'Deposits from the Tondo fund',
  'Deposits from 21.gifts',
  'Withdrawals from outside',
  'Withdrawals from members',
  'Withdrawals from the Tondo fund',
  'Withdrawals from 21.gifts',
  'Shop sales to outside',
  'Shop sales to members',
  'Shop sales to the Tondo fund',
  'Shop sales to 21.gifts',
  'Forum gifts from outside',
  'Forum gifts from members',
  'Forum gifts from the Tondo fund',
  'Forum gifts from 21.gifts',
  'Transfers from outside',
  'Transfers from members',
  'Transfers from the Tondo fund',
  'Transfers from 21.gifts',
  'Into the Tondo fund from outside',
  'Into the Tondo fund from members',
  'Into the Tondo fund from the Tondo fund',
  'Into the Tondo fund from 21.gifts',
  'Gifts from the Tondo fund',
  'Gifts from outside',
  'Gifts from members',
  'Gifts from 21.gifts',
  'Other from outside',
  'Other from members',
  'Other from the Tondo fund',
  'Other from 21.gifts',
];

const MEMBER_TO = [
  'Deposits to outside',
  'Deposits to members',
  'Deposits to the Tondo fund',
  'Deposits to 21.gifts',
  'Withdrawals to outside',
  'Withdrawals to members',
  'Withdrawals to the Tondo fund',
  'Withdrawals to 21.gifts',
  'Shop purchases from members',
  'Shop purchases to outside',
  'Shop purchases to the Tondo fund',
  'Shop purchases to 21.gifts',
  'Forum gifts to members',
  'Forum gifts to outside',
  'Forum gifts to the Tondo fund',
  'Forum gifts to 21.gifts',
  'Transfers to outside',
  'Transfers to members',
  'Transfers to the Tondo fund',
  'Transfers to 21.gifts',
  'Into the Tondo fund',
  'Into members',
  'Into outside',
  'Into 21.gifts',
  'Gifts to members',
  'Gifts to outside',
  'Gifts to the Tondo fund',
  'Gifts to 21.gifts',
  'Other to outside',
  'Other to members',
  'Other to the Tondo fund',
  'Other to 21.gifts',
];

function memberFlows(): WalletUsageFlow[] {
  const rows: WalletUsageFlow[] = [];
  let n = 0;
  for (const purpose of PURPOSES) {
    for (const from of PARTIES) {
      n += 1;
      rows.push(flow('2026-11-09', from, 'members', purpose, 1, 1000 + n, 0));
    }
    for (const to of PARTIES) {
      n += 1;
      rows.push(flow('2026-11-09', 'members', to, purpose, 1, 2000 + n, 0));
    }
  }
  rows.push(flow('2026-11-09', 'members', 'outside', 'withdrawal', 1, 10, 7));
  rows.push(flow('2026-11-09', 'members', 'members', 'transfer', 1, 10, 99));
  rows.push(flow('2026-11-09', 'outside', 'members', 'deposit', 1, 15, 50));
  return rows;
}

/** Reports a container width. `emitOnObserve` false leaves the first render wide. */
class WidthObserver {
  static latest: WidthObserver | null = null;
  static emitOnObserve = true;
  static initial = 800;
  readonly disconnect = vi.fn();

  constructor(readonly onResize: ResizeObserverCallback) {
    WidthObserver.latest = this;
  }

  observe(): void {
    if (WidthObserver.emitOnObserve) {
      this.send(WidthObserver.initial);
    }
  }

  send(width: number): void {
    this.onResize(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  sendEmpty(): void {
    this.onResize([], this as unknown as ResizeObserver);
  }
}

/**
 * Installs {@link WidthObserver} and restores the previous constructor.
 *
 * @param initial - Width reported from `observe`, when emitting is on.
 * @param emitOnObserve - Whether `observe` reports `initial` immediately.
 * @returns Restores the previous `ResizeObserver`.
 */
function installWidthObserver(initial: number, emitOnObserve: boolean): () => void {
  WidthObserver.latest = null;
  WidthObserver.initial = initial;
  WidthObserver.emitOnObserve = emitOnObserve;
  const previous = globalThis.ResizeObserver;
  globalThis.ResizeObserver = WidthObserver as unknown as typeof ResizeObserver;
  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    } else {
      globalThis.ResizeObserver = previous;
    }
  };
}

function latestObserver(): WidthObserver {
  const observer = WidthObserver.latest;
  if (observer === null) {
    throw new Error('missing observer');
  }
  return observer;
}

function barPercent(root: Element, label: string): number {
  const bar = requireFlow(root, label).querySelector('[data-metric]');
  if (bar === null) {
    throw new Error(`missing bar ${label}`);
  }
  const width = bar.getAttribute('width');
  if (width === null) {
    throw new Error(`missing width ${label}`);
  }
  return Number(width);
}

function columnPercent(root: Element, side: 'from' | 'to'): number {
  const nodes = root.querySelectorAll(`[data-side="${side}"]`);
  let total = 0;
  for (const node of nodes) {
    const label = node.getAttribute('data-flow');
    if (label === null) {
      throw new Error('missing flow');
    }
    total += barPercent(root, label);
  }
  return total;
}

function lastFlow(root: Element, side: 'from' | 'to'): string {
  const nodes = root.querySelectorAll(`[data-side="${side}"]`);
  const last = nodes.item(nodes.length - 1);
  if (last === null) {
    throw new Error(`missing ${side}`);
  }
  const label = last.getAttribute('data-flow');
  if (label === null) {
    throw new Error(`missing ${side} label`);
  }
  return label;
}

const PRICED_SPOT = {
  rateDay: {
    sats: 100_000_000,
    usd: '100000.00',
    chf: '80000.00',
    eur: '90000.00',
    php: '5600000.00',
  },
  fiat: 'USD' as const,
};

describe('accountBalances', () => {
  it('returns nothing when there is no day', () => {
    expect(accountBalances('fund', [], LEDGER)).toEqual([]);
  });

  it('keeps the fund and member running balances, including a negative day', () => {
    const fund = accountBalances('fund', DAYS, LEDGER);
    expect(fund.map((row) => row.endSats)).toEqual([505334, 436212, 394179, 425057]);
    expect(fund.map((row) => row.inflowSats)).toEqual([574455, 0, 27088, 100000]);
    expect(fund.map((row) => row.outflowSats)).toEqual([69121, 69122, 69121, 69122]);
    expect(fund[0]?.startSats).toBe(0);
    expect(fund[3]?.endSats).toBe(425057);

    const members = accountBalances('members', DAYS, LEDGER);
    expect(members.map((row) => row.endSats)).toEqual([-91379, 67673, 232429, 298346]);
    expect(members[0]?.outflowSats).toBe(280500);
    expect(members[1]?.outflowSats).toBe(20070);
    expect(members[3]?.endSats).toBe(298346);
  });
});

describe('WalletFlowDiagram', () => {
  it('names every incoming and outgoing group and pins the start balance', () => {
    render(
      <>
        <WalletFlowDiagram
          account="members"
          accountLabel="Member wallets"
          flows={memberFlows()}
          startSats={50}
          endSats={80}
          metric="amount"
          numberFormat="ch"
        />
        <WalletFlowDiagram
          account="fund"
          accountLabel="Tondo fund"
          flows={[
            flow('2026-11-09', 'outside', 'fund', 'shop_purchase', 1, 11, 0),
            flow('2026-11-09', 'members', 'fund', 'shop_purchase', 1, 12, 0),
            flow('2026-11-09', 'fund', 'fund', 'shop_purchase', 1, 13, 0),
            flow('2026-11-09', 'platform', 'fund', 'shop_purchase', 1, 14, 0),
            flow('2026-11-09', 'outside', 'fund', 'fund_deposit', 1, 21, 0),
            flow('2026-11-09', 'members', 'fund', 'fund_deposit', 1, 22, 0),
            flow('2026-11-09', 'fund', 'fund', 'fund_deposit', 1, 23, 0),
            flow('2026-11-09', 'platform', 'fund', 'fund_deposit', 1, 24, 0),
            flow('2026-11-09', 'fund', 'members', 'fund_payout', 2, 40, 5),
          ]}
          startSats={50}
          endSats={80}
          metric="amount"
          numberFormat="ch"
        />
      </>,
    );
    const members = screen.getByRole('img', { name: 'Member wallets' });
    const fund = screen.getByRole('img', { name: 'Tondo fund' });
    for (const label of MEMBER_FROM) {
      expect(requireFlow(members, label).getAttribute('data-side')).toBe('from');
    }
    for (const label of MEMBER_TO) {
      expect(requireFlow(members, label).getAttribute('data-side')).toBe('to');
    }
    expect(metricOf(members, 'Fees')).toBe('7');
    expect(metricOf(members, 'Shop sales to members')).toBe(
      metricOf(members, 'Shop purchases from members'),
    );
    expect(metricOf(members, 'Shop sales to outside')).not.toBe(
      metricOf(members, 'Shop sales to members'),
    );
    expect(requireFlow(members, 'Balance at start of day').getAttribute('data-side')).toBe('from');
    expect(requireFlow(members, 'Balance at end of day').getAttribute('data-side')).toBe('to');
    for (const label of [
      'Shop purchases from outside',
      'Shop purchases from members',
      'Shop purchases from the Tondo fund',
      'Shop purchases from 21.gifts',
      'Into the Tondo fund from outside',
      'Into the Tondo fund from members',
      'Into the Tondo fund from the Tondo fund',
      'Into the Tondo fund from 21.gifts',
    ]) {
      expect(requireFlow(fund, label)).toBeTruthy();
    }
    expect(metricOf(fund, 'Fees')).toBe('5');

    const ribbon = requireFlow(members, 'Deposits from outside');
    const frame = members.parentElement;
    if (frame === null) {
      throw new Error('missing diagram frame');
    }
    const status = frame.querySelector('[role="status"]');
    if (status === null) {
      throw new Error('missing status');
    }
    fireEvent.mouseEnter(ribbon);
    expect(status.textContent).toContain('Deposits from outside');
    expect(status.textContent).toContain('payments');
    fireEvent.mouseLeave(ribbon);
    expect(status.textContent).toBe('');
    fireEvent.focus(ribbon);
    expect(status.textContent).toContain('Deposits from outside');
    fireEvent.blur(ribbon);
    expect(status.textContent).toBe('');
  });

  it('shows and hides the tooltip on a right-side ribbon', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[flow('2026-11-09', 'members', 'outside', 'withdrawal', 3, 40, 0)]}
        startSats={50}
        endSats={80}
        metric="amount"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    const ribbon = diagram.querySelector('[data-side="to"]');
    const frame = diagram.parentElement;
    if (ribbon === null || frame === null) {
      throw new Error('missing right-side ribbon');
    }
    expect(ribbon.getAttribute('data-flow')).toBe('Withdrawals to outside');
    const status = frame.querySelector('[role="status"]');
    if (status === null) {
      throw new Error('missing status');
    }
    fireEvent.mouseEnter(ribbon);
    expect(status.textContent).toBe('Withdrawals to outside: 3 payments · \u20bf40');
    fireEvent.mouseLeave(ribbon);
    expect(status.textContent).toBe('');
    fireEvent.focus(ribbon);
    expect(status.textContent).toBe('Withdrawals to outside: 3 payments · \u20bf40');
    fireEvent.blur(ribbon);
    expect(status.textContent).toBe('');
  });

  it('pins the opening balance under a taller outgoing column', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[
          flow('2026-11-09', 'outside', 'members', 'deposit', 1, 100, 0),
          flow('2026-11-09', 'members', 'outside', 'withdrawal', 1, 40, 15),
          flow('2026-11-09', 'members', 'fund', 'shop_purchase', 1, 30, 0),
          flow('2026-11-09', 'members', 'platform', 'forum_gift', 1, 20, 0),
          flow('2026-11-09', 'members', 'members', 'transfer', 1, 10, 0),
        ]}
        startSats={5}
        endSats={9}
        metric="amount"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    const start = requireFlow(diagram, 'Balance at start of day').querySelector('text');
    const deposit = requireFlow(diagram, 'Deposits from outside').querySelector('text');
    if (start === null || deposit === null) {
      throw new Error('missing label');
    }
    expect(start.getAttribute('y')).toBe('220');
    expect(deposit.getAttribute('y')).toBe('40');
  });

  it('pins a negative end balance to the bottom of the left column', () => {
    render(
      <WalletFlowDiagram
        account="fund"
        accountLabel="Tondo fund"
        flows={[
          flow('2026-11-09', 'fund', 'members', 'fund_payout', 1, 80, 0),
          flow('2026-11-09', 'fund', 'outside', 'withdrawal', 1, 40, 0),
          flow('2026-11-09', 'fund', 'platform', 'other', 1, 20, 10),
        ]}
        startSats={100}
        endSats={-50}
        metric="amount"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Tondo fund' });
    expect(diagram.getAttribute('viewBox')).toBe('0 0 760 174');
    expect(diagram.querySelector('[data-flow="Balance at end of day"]')).toBeNull();
    expect(metricOf(diagram, 'Balance below zero at end of day')).toBe('50');
    expect(requireFlow(diagram, 'Balance below zero at end of day').getAttribute('data-side')).toBe(
      'from',
    );
    expect(metricOf(diagram, 'Balance at start of day')).toBe('100');
    expect(columnMetric(diagram, 'from')).toBe(columnMetric(diagram, 'to'));
    const start = requireFlow(diagram, 'Balance at start of day').querySelector('text');
    const end = requireFlow(diagram, 'Balance below zero at end of day').querySelector('text');
    if (start === null || end === null) {
      throw new Error('missing balance label');
    }
    expect(start.getAttribute('y')).toBe('112');
    expect(end.getAttribute('y')).toBe('148');
    const frame = diagram.parentElement;
    if (frame === null) {
      throw new Error('missing diagram frame');
    }
    fireEvent.mouseEnter(requireFlow(diagram, 'Balance below zero at end of day'));
    expect(frame.querySelector('[role="status"]')?.textContent).toBe(
      'Balance below zero at end of day: \u2212\u20bf50',
    );
    fireEvent.mouseEnter(requireFlow(diagram, 'Balance at start of day'));
    expect(frame.querySelector('[role="status"]')?.textContent).toBe(
      'Balance at start of day: \u20bf100',
    );
  });

  it('shows an end balance without a start balance', () => {
    render(
      <WalletFlowDiagram
        account="fund"
        accountLabel="Tondo fund"
        flows={[]}
        startSats={0}
        endSats={40}
        metric="amount"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Tondo fund' });
    expect(diagram.querySelector('[data-flow="Balance at start of day"]')).toBeNull();
    expect(metricOf(diagram, 'Balance at end of day')).toBe('40');
  });

  it('says there were no payments when amount mode has no balance and no flows', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[]}
        startSats={0}
        endSats={0}
        metric="amount"
        numberFormat="ch"
      />,
    );
    expect(screen.getByText('No payments on this day')).toBeTruthy();
  });

  it('draws both below-zero balances when the span never crosses zero', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[]}
        startSats={-5}
        endSats={-3}
        metric="amount"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    expect(requireFlow(diagram, 'Balance below zero at end of day').getAttribute('data-side')).toBe(
      'from',
    );
    expect(metricOf(diagram, 'Balance below zero at end of day')).toBe('3');
    expect(
      requireFlow(diagram, 'Balance below zero at start of day').getAttribute('data-side'),
    ).toBe('to');
    expect(metricOf(diagram, 'Balance below zero at start of day')).toBe('5');
  });

  it('hides balances and fees in count mode, including a positive start', () => {
    const hidden = render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[]}
        startSats={100}
        endSats={50}
        metric="count"
        numberFormat="ch"
      />,
    );
    expect(screen.getByText('No payments on this day')).toBeTruthy();
    hidden.unmount();
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[
          flow('2026-11-09', 'outside', 'members', 'other', 4, 0, 0),
          flow('2026-11-09', 'outside', 'members', 'deposit', 0, 80, 0),
          flow('2026-11-09', 'members', 'outside', 'withdrawal', 3, 30, 9),
        ]}
        startSats={100}
        endSats={50}
        metric="count"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    expect(requireFlow(diagram, 'Other from outside')).toBeTruthy();
    expect(diagram.querySelector('[data-flow="Deposits from outside"]')).toBeNull();
    expect(diagram.querySelector('[data-flow="Fees"]')).toBeNull();
    expect(diagram.querySelector('[data-flow="Balance at start of day"]')).toBeNull();
    expect(metricOf(diagram, 'Withdrawals to outside')).toBe('3');
  });

  it('drops a zero count in amount mode and keeps equal amounts on one budget', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[
          flow('2026-11-09', 'outside', 'members', 'other', 4, 0, 0),
          flow('2026-11-09', 'outside', 'members', 'deposit', 0, 40, 0),
          flow('2026-11-09', 'fund', 'members', 'transfer', 2, 40, 0),
          flow('2026-11-09', 'members', 'outside', 'withdrawal', 1, 80, 0),
        ]}
        startSats={0}
        endSats={0}
        metric="amount"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    expect(diagram.querySelector('[data-flow="Other from outside"]')).toBeNull();
    expect(metricOf(diagram, 'Deposits from outside')).toBe('40');
    expect(metricOf(diagram, 'Transfers from the Tondo fund')).toBe('40');
    expect(metricOf(diagram, 'Withdrawals to outside')).toBe('80');
    expect(requireFlow(diagram, 'Balance at end of day')).toBeTruthy();
  });

  it('draws a member-to-member flow with the same ribbon thickness on both sides', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[
          flow('2026-11-09', 'outside', 'members', 'deposit', 10, 1, 0),
          flow('2026-11-09', 'members', 'members', 'forum_gift', 4, 1, 0),
          flow('2026-11-09', 'members', 'outside', 'withdrawal', 2, 1, 0),
        ]}
        startSats={80}
        endSats={20}
        metric="count"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    const from = ribbonThickness(diagram, 'Forum gifts from members');
    const to = ribbonThickness(diagram, 'Forum gifts to members');
    expect(from).toBe(to);
    expect(from).toBeGreaterThan(0);
    expect(metricOf(diagram, 'Forum gifts from members')).toBe('4');
    expect(metricOf(diagram, 'Forum gifts to members')).toBe('4');
    expect(columnThickness(diagram, 'to')).toBeLessThan(columnThickness(diagram, 'from'));
    expect(diagram.querySelector('[data-flow="Balance at start of day"]')).toBeNull();
  });

  it('keeps both amount columns equal when the day starts below zero', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[
          flow('2026-11-09', 'outside', 'members', 'deposit', 2, 150, 0),
          flow('2026-11-09', 'members', 'members', 'forum_gift', 4, 50, 0),
          flow('2026-11-09', 'members', 'outside', 'withdrawal', 1, 30, 0),
        ]}
        startSats={-20}
        endSats={100}
        metric="amount"
        numberFormat="ch"
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    expect(columnMetric(diagram, 'from')).toBe(200);
    expect(columnMetric(diagram, 'to')).toBe(200);
    expect(ribbonThickness(diagram, 'Forum gifts from members')).toBe(
      ribbonThickness(diagram, 'Forum gifts to members'),
    );
    const below = requireFlow(diagram, 'Balance below zero at start of day');
    expect(below.getAttribute('data-side')).toBe('to');
    expect(metricOf(diagram, 'Balance below zero at start of day')).toBe('20');
    expect(diagram.querySelector('[data-flow="Balance at start of day"]')).toBeNull();
    const opening = below.querySelector('text');
    const closing = requireFlow(diagram, 'Balance at end of day').querySelector('text');
    const gift = requireFlow(diagram, 'Forum gifts to members').querySelector('text');
    if (opening === null || closing === null || gift === null) {
      throw new Error('missing label');
    }
    const openingY = Number(opening.getAttribute('y'));
    const closingY = Number(closing.getAttribute('y'));
    expect(openingY).toBeGreaterThan(Number(gift.getAttribute('y')));
    expect(closingY).toBeGreaterThan(openingY);
  });

  it('shows fiat beside every ribbon amount when a spot is passed', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[
          flow('2026-11-09', 'outside', 'members', 'deposit', 2, 100, 0),
          flow('2026-11-09', 'members', 'outside', 'withdrawal', 1, 40, 7),
        ]}
        startSats={-50}
        endSats={10}
        metric="amount"
        numberFormat="ch"
        spot={{
          rateDay: {
            sats: 100_000_000,
            usd: '100000.00',
            chf: '80000.00',
            eur: '90000.00',
            php: '5600000.00',
          },
          fiat: 'USD',
        }}
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    const frame = diagram.parentElement;
    if (frame === null) {
      throw new Error('missing diagram frame');
    }
    const status = frame.querySelector('[role="status"]');
    fireEvent.mouseEnter(requireFlow(diagram, 'Deposits from outside'));
    expect(status?.textContent).toBe('Deposits from outside: 2 payments · \u20bf100 · $0.10');
    fireEvent.mouseEnter(requireFlow(diagram, 'Withdrawals to outside'));
    expect(status?.textContent).toBe('Withdrawals to outside: 1 payments · \u20bf40 · $0.04');
    fireEvent.mouseEnter(requireFlow(diagram, 'Fees'));
    expect(status?.textContent).toBe('Fees: 1 payments · \u20bf7 · $0.01');
    fireEvent.mouseEnter(requireFlow(diagram, 'Balance below zero at start of day'));
    expect(status?.textContent).toBe(
      'Balance below zero at start of day: \u2212\u20bf50 · \u2212$0.05',
    );
    fireEvent.mouseEnter(requireFlow(diagram, 'Balance at end of day'));
    expect(status?.textContent).toBe('Balance at end of day: \u20bf10 · $0.01');
  });

  it('shows bitcoin alone on ribbon tooltips when the spot cannot price them', () => {
    render(
      <WalletFlowDiagram
        account="members"
        accountLabel="Member wallets"
        flows={[flow('2026-11-09', 'outside', 'members', 'deposit', 2, 100, 0)]}
        startSats={-50}
        endSats={10}
        metric="amount"
        numberFormat="ch"
        spot={{ rateDay: null, fiat: 'USD' }}
      />,
    );
    const diagram = screen.getByRole('img', { name: 'Member wallets' });
    const frame = diagram.parentElement;
    if (frame === null) {
      throw new Error('missing diagram frame');
    }
    const status = frame.querySelector('[role="status"]');
    fireEvent.mouseEnter(requireFlow(diagram, 'Deposits from outside'));
    expect(status?.textContent).toBe('Deposits from outside: 2 payments · \u20bf100');
    fireEvent.mouseEnter(requireFlow(diagram, 'Balance below zero at start of day'));
    expect(status?.textContent).toBe('Balance below zero at start of day: \u2212\u20bf50');
    fireEvent.mouseEnter(requireFlow(diagram, 'Balance at end of day'));
    expect(status?.textContent).toBe('Balance at end of day: \u20bf10');
    expect(status?.textContent).not.toContain('$');
  });

  it('keeps the sankey at 520 px and uses lists below that', () => {
    const restore = installWidthObserver(800, true);
    try {
      render(
        <WalletFlowDiagram
          account="members"
          accountLabel="Member wallets"
          flows={[flow('2026-11-09', 'outside', 'members', 'deposit', 1, 10, 0)]}
          startSats={0}
          endSats={0}
          metric="amount"
          numberFormat="ch"
        />,
      );
      const wide = screen.getByRole('img', { name: 'Member wallets' });
      expect(wide.getAttribute('data-layout')).toBe('sankey');
      expect(wide.querySelector('text')?.getAttribute('y')).toBe('14');
      act(() => {
        latestObserver().send(520);
      });
      expect(screen.getByRole('img', { name: 'Member wallets' }).getAttribute('data-layout')).toBe(
        'sankey',
      );
      act(() => {
        latestObserver().send(519);
      });
      const narrow = screen.getByRole('img', { name: 'Member wallets' });
      expect(narrow.getAttribute('data-layout')).toBe('compact');
      expect(narrow.querySelector('svg[viewBox="0 0 100 8"]')).not.toBeNull();
      expect(narrow.textContent).toContain('Where from');
      expect(narrow.textContent).toContain('Where to');
    } finally {
      restore();
    }
  });

  it('draws narrow rows on one scale, with balances last and the same status line', () => {
    const restore = installWidthObserver(360, true);
    try {
      render(
        <>
          <WalletFlowDiagram
            account="members"
            accountLabel="Member wallets"
            flows={[
              flow('2026-11-09', 'outside', 'members', 'deposit', 2, 100, 0),
              flow('2026-11-09', 'members', 'outside', 'withdrawal', 1, 40, 7),
            ]}
            startSats={50}
            endSats={10}
            metric="amount"
            numberFormat="ch"
            spot={PRICED_SPOT}
          />
          <WalletFlowDiagram
            account="fund"
            accountLabel="Tondo fund"
            flows={[flow('2026-11-09', 'outside', 'fund', 'deposit', 1, 80, 0)]}
            startSats={0}
            endSats={20}
            metric="amount"
            numberFormat="ch"
            spot={{ rateDay: null, fiat: 'USD' }}
          />
        </>,
      );
      const diagram = screen.getByRole('img', { name: 'Member wallets' });
      expect(diagram.getAttribute('data-layout')).toBe('compact');
      const text = diagram.textContent;
      if (text === null) {
        throw new Error('missing diagram text');
      }
      const whereFrom = text.indexOf('Where from');
      const depositAt = text.indexOf('Deposits from outside');
      const accountAt = text.indexOf('Member wallets');
      const whereTo = text.indexOf('Where to');
      const withdrawalAt = text.indexOf('Withdrawals to outside');
      expect(whereFrom).toBeGreaterThanOrEqual(0);
      expect(whereFrom).toBeLessThan(depositAt);
      expect(depositAt).toBeLessThan(accountAt);
      expect(accountAt).toBeLessThan(whereTo);
      expect(whereTo).toBeLessThan(withdrawalAt);
      expect(lastFlow(diagram, 'from')).toBe('Balance at start of day');
      expect(lastFlow(diagram, 'to')).toBe('Balance at end of day');
      const deposit = requireFlow(diagram, 'Deposits from outside');
      if (!(deposit instanceof HTMLElement)) {
        throw new Error('missing deposit row');
      }
      expect(deposit.className).toContain('text-sm');
      expect(deposit.className).not.toContain('break-words');
      expect(deposit.textContent).toContain('\u20bf100 · $0.10');
      expect(requireFlow(diagram, 'Fees').textContent).toContain('\u20bf7 · $0.01');
      expect(requireFlow(diagram, 'Balance at start of day').textContent).toContain(
        '\u20bf50 · $0.05',
      );
      const depositBar = deposit.querySelector('[data-metric]');
      const feeBar = requireFlow(diagram, 'Fees').querySelector('[data-metric]');
      const balanceBar = requireFlow(diagram, 'Balance at start of day').querySelector(
        '[data-metric]',
      );
      if (depositBar === null || feeBar === null || balanceBar === null) {
        throw new Error('missing bar');
      }
      expect(depositBar.getAttribute('class')).toContain('fill-emerald-400');
      expect(feeBar.getAttribute('class')).toContain('fill-paper/40');
      expect(balanceBar.getAttribute('class')).toContain('fill-paper/25');
      const depositWidth = barPercent(diagram, 'Deposits from outside');
      const openingWidth = barPercent(diagram, 'Balance at start of day');
      expect(depositWidth / openingWidth).toBeCloseTo(2);
      const total = diagram.querySelector('[data-scale-total]');
      expect(total?.getAttribute('data-scale-total')).toBe('150');
      expect(total?.textContent).toBe('\u20bf150 · $0.15');
      const frame = diagram.parentElement;
      if (frame === null) {
        throw new Error('missing diagram frame');
      }
      const status = frame.querySelector('[role="status"]');
      fireEvent.mouseEnter(deposit);
      expect(status?.textContent).toBe('Deposits from outside: 2 payments · \u20bf100 · $0.10');
      fireEvent.mouseLeave(deposit);
      expect(status?.textContent).toBe('');
      fireEvent.focus(deposit);
      expect(status?.textContent).toBe('Deposits from outside: 2 payments · \u20bf100 · $0.10');
      fireEvent.blur(deposit);
      expect(status?.textContent).toBe('');
      fireEvent.mouseEnter(requireFlow(diagram, 'Withdrawals to outside'));
      expect(status?.textContent).toBe('Withdrawals to outside: 1 payments · \u20bf40 · $0.04');

      const fund = screen.getByRole('img', { name: 'Tondo fund' });
      expect(fund.getAttribute('data-layout')).toBe('compact');
      expect(fund.textContent).not.toContain('$');
      expect(fund.querySelector('[data-scale-total]')?.textContent).toBe('\u20bf80');
      expect(requireFlow(fund, 'Deposits from outside').textContent).toContain('\u20bf80');
    } finally {
      restore();
    }
  });

  it('uses the shared count scale and omits balances when the container is narrow', () => {
    const restore = installWidthObserver(360, true);
    try {
      render(
        <WalletFlowDiagram
          account="members"
          accountLabel="Member wallets"
          flows={[
            flow('2026-11-09', 'outside', 'members', 'deposit', 10, 1, 0),
            flow('2026-11-09', 'members', 'members', 'forum_gift', 4, 1, 0),
            flow('2026-11-09', 'members', 'outside', 'withdrawal', 2, 1, 0),
          ]}
          startSats={80}
          endSats={20}
          metric="count"
          numberFormat="ch"
        />,
      );
      const diagram = screen.getByRole('img', { name: 'Member wallets' });
      expect(diagram.getAttribute('data-layout')).toBe('compact');
      expect(diagram.querySelector('[data-flow="Fees"]')).toBeNull();
      expect(diagram.querySelector('[data-flow="Balance at start of day"]')).toBeNull();
      expect(requireFlow(diagram, 'Deposits from outside').textContent).toContain('10');
      expect(barPercent(diagram, 'Forum gifts from members')).toBeCloseTo(
        barPercent(diagram, 'Forum gifts to members'),
      );
      expect(columnPercent(diagram, 'from')).toBeCloseTo(100);
      expect(columnPercent(diagram, 'to')).toBeLessThan(columnPercent(diagram, 'from'));
      const total = diagram.querySelector('[data-scale-total]');
      expect(total?.getAttribute('data-scale-total')).toBe('14');
      expect(total?.textContent).toBe('14');
    } finally {
      restore();
    }
  });

  it('ignores an empty resize and a zero width, then disconnects', () => {
    const restore = installWidthObserver(0, false);
    try {
      const view = render(
        <WalletFlowDiagram
          account="members"
          accountLabel="Member wallets"
          flows={[flow('2026-11-09', 'outside', 'members', 'deposit', 1, 10, 0)]}
          startSats={0}
          endSats={0}
          metric="amount"
          numberFormat="ch"
        />,
      );
      expect(screen.getByRole('img', { name: 'Member wallets' }).getAttribute('data-layout')).toBe(
        'sankey',
      );
      const observer = latestObserver();
      act(() => {
        observer.sendEmpty();
      });
      expect(screen.getByRole('img', { name: 'Member wallets' }).getAttribute('data-layout')).toBe(
        'sankey',
      );
      act(() => {
        observer.send(0);
      });
      expect(screen.getByRole('img', { name: 'Member wallets' }).getAttribute('data-layout')).toBe(
        'sankey',
      );
      act(() => {
        observer.send(400);
      });
      expect(screen.getByRole('img', { name: 'Member wallets' }).getAttribute('data-layout')).toBe(
        'compact',
      );
      view.unmount();
      expect(observer.disconnect).toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('stays on the sankey when the browser has no ResizeObserver', () => {
    const previous = globalThis.ResizeObserver;
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
    try {
      render(
        <WalletFlowDiagram
          account="members"
          accountLabel="Member wallets"
          flows={[flow('2026-11-09', 'outside', 'members', 'deposit', 1, 10, 0)]}
          startSats={0}
          endSats={0}
          metric="amount"
          numberFormat="ch"
        />,
      );
      const diagram = screen.getByRole('img', { name: 'Member wallets' });
      expect(diagram.getAttribute('data-layout')).toBe('sankey');
      expect(diagram.querySelector('[data-flow="Deposits from outside"]')).toBeTruthy();
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(globalThis, 'ResizeObserver');
      } else {
        globalThis.ResizeObserver = previous;
      }
    }
  });
});
