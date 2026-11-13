'use client';

import { useState, type ReactElement } from 'react';
import type {
  WalletParty,
  WalletPurpose,
  WalletUsageFlow,
} from '@/lib/api-types';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';
import { formatCount } from '@/components/StatsDashboard';
import type { NumberFormatStyle } from '@/lib/number-format';

/** Parties drawn on a wallet-usage flow. */
export const PARTY_LABEL: Record<WalletParty, string> = {
  outside: 'Outside',
  members: 'Members',
  fund: 'Tondo fund',
  platform: '21.gifts',
};

/** Purpose names, the same words on every chart and in the table. */
export const PURPOSE_LABEL: Record<WalletPurpose, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  shop_purchase: 'Shop purchase',
  forum_gift: 'Forum gifts & hearts',
  transfer: 'Transfer',
  fund_deposit: 'Into the Tondo fund',
  fund_payout: 'Gifts from the Tondo fund',
  other: 'Other',
};

/** SVG fill for one purpose. The same class is used on every chart. */
export const PURPOSE_FILL_CLASS: Record<WalletPurpose, string> = {
  forum_gift: 'fill-accent',
  shop_purchase: 'fill-sky-400',
  deposit: 'fill-emerald-400',
  withdrawal: 'fill-rose-400',
  transfer: 'fill-violet-400',
  fund_deposit: 'fill-amber-300',
  fund_payout: 'fill-cyan-300',
  other: 'fill-stone-400',
};

/** Legend swatch for one purpose. Matches {@link PURPOSE_FILL_CLASS}. */
export const PURPOSE_SWATCH_CLASS: Record<WalletPurpose, string> = {
  forum_gift: 'bg-accent',
  shop_purchase: 'bg-sky-400',
  deposit: 'bg-emerald-400',
  withdrawal: 'bg-rose-400',
  transfer: 'bg-violet-400',
  fund_deposit: 'bg-amber-300',
  fund_payout: 'bg-cyan-300',
  other: 'bg-stone-400',
};

/** Amount ribbons or payment-count ribbons. */
export type WalletFlowMetric = 'amount' | 'count';

/** One day's opening and closing balance for one account. */
export type AccountBalanceDay = {
  day: string;
  startSats: number;
  inflowSats: number;
  outflowSats: number;
  endSats: number;
};

const HEADER = 22;
const MIN_SLOT = 36;
const VIEW_W = 760;
const LABEL_W = 250;
const CENTER_W = 120;

/**
 * Running balance of one account from the release day.
 *
 * The release day starts at 0. Inflow is sats into the account from somewhere
 * else. Outflow is sats plus fees leaving the account. The next day starts
 * where this day ends. A payment from the account to itself does not move
 * the balance. Negative balances are kept.
 *
 * @param account - `fund` or `members`.
 * @param days - UTC days in the order the balance should advance.
 * @param flows - Aggregated flows. Rows for other days are ignored.
 * @returns One row per day. Empty when `days` is empty.
 */
export function accountBalances(
  account: 'fund' | 'members',
  days: readonly { day: string }[],
  flows: readonly WalletUsageFlow[],
): AccountBalanceDay[] {
  const rows: AccountBalanceDay[] = [];
  let startSats = 0;
  for (const day of days) {
    let inflowSats = 0;
    let outflowSats = 0;
    for (const flow of flows) {
      if (flow.day !== day.day) {
        continue;
      }
      if (flow.to === account && flow.from !== account) {
        inflowSats += flow.sats;
      }
      if (flow.from === account && flow.to !== account) {
        outflowSats += flow.sats + flow.feeSats;
      }
    }
    const endSats = startSats + inflowSats - outflowSats;
    rows.push({ day: day.day, startSats, inflowSats, outflowSats, endSats });
    startSats = endSats;
  }
  return rows;
}

/**
 * Lower-case party phrase used inside a flow label.
 *
 * @param party - Flow endpoint.
 * @returns "outside", "members", "the Tondo fund", or "21.gifts".
 */
function phraseParty(party: WalletParty): string {
  if (party === 'fund') {
    return 'the Tondo fund';
  }
  if (party === 'platform') {
    return '21.gifts';
  }
  return party;
}

/**
 * Left-column label for money arriving at `account`.
 *
 * @param account - Diagram account.
 * @param from - Party the payments came from. The label names this party.
 * @param purpose - Why the payments were made.
 * @returns One short English label.
 */
function incomingLabel(
  account: 'fund' | 'members',
  from: WalletParty,
  purpose: WalletPurpose,
): string {
  switch (purpose) {
    case 'deposit':
      return `Deposits from ${phraseParty(from)}`;
    case 'withdrawal':
      return `Withdrawals from ${phraseParty(from)}`;
    case 'shop_purchase':
      return account === 'members'
        ? `Shop sales to ${phraseParty(from)}`
        : `Shop purchases from ${phraseParty(from)}`;
    case 'forum_gift':
      return `Forum gifts from ${phraseParty(from)}`;
    case 'transfer':
      return `Transfers from ${PARTY_LABEL[from]}`;
    case 'fund_deposit':
      return account === 'fund'
        ? PARTY_LABEL[from]
        : `Into the Tondo fund from ${PARTY_LABEL[from]}`;
    case 'fund_payout':
      return from === 'fund' ? 'Gifts from the Tondo fund' : `Gifts from ${phraseParty(from)}`;
    case 'other':
      return `Other from ${phraseParty(from)}`;
  }
}

/**
 * Right-column label for money leaving `account`.
 *
 * @param to - Party the payments went to. The label names this party.
 * @param purpose - Why the payments were made.
 * @returns One short English label.
 */
function outgoingLabel(to: WalletParty, purpose: WalletPurpose): string {
  switch (purpose) {
    case 'deposit':
      return `Deposits to ${phraseParty(to)}`;
    case 'withdrawal':
      return `Withdrawals to ${phraseParty(to)}`;
    case 'shop_purchase':
      return to === 'members'
        ? 'Shop purchases from members'
        : `Shop purchases to ${phraseParty(to)}`;
    case 'forum_gift':
      return to === 'members' ? 'Forum gifts to members' : `Forum gifts to ${phraseParty(to)}`;
    case 'transfer':
      return `Transfers to ${phraseParty(to)}`;
    case 'fund_deposit':
      return to === 'fund' ? 'Into the Tondo fund' : `Into ${phraseParty(to)}`;
    case 'fund_payout':
      return to === 'members' ? 'Gifts to members' : `Gifts to ${phraseParty(to)}`;
    case 'other':
      return `Other to ${phraseParty(to)}`;
  }
}

type PurposeNode = {
  kind: 'purpose';
  purpose: WalletPurpose;
  key: string;
  label: string;
  count: number;
  sats: number;
  metric: number;
};

type FeeNode = {
  kind: 'fee';
  key: string;
  label: string;
  count: number;
  sats: number;
  metric: number;
};

type BalanceNode = {
  kind: 'balance';
  key: string;
  label: string;
  count: number;
  sats: number;
  metric: number;
};

type RibbonNode = PurposeNode | FeeNode | BalanceNode;

type FlowGroup = {
  party: WalletParty;
  purpose: WalletPurpose;
  label: string;
  count: number;
  sats: number;
};

/** Spot that prices a ribbon tooltip. Omitted means bitcoin alone. */
type FlowSpot = {
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
};

/**
 * Signed bitcoin for a balance that may be negative.
 *
 * @param sats - Whole sats. Negative values keep a minus.
 * @param style - Grouping style.
 * @returns `₿…` or a leading unicode minus plus `₿…`.
 */
function signedSats(sats: number, style: NumberFormatStyle): string {
  if (sats < 0) {
    return `\u2212${formatBitcoin(-sats, style)}`;
  }
  return formatBitcoin(sats, style);
}

/**
 * Preferred fiat for a sat amount, matching the wallet-usage tiles.
 *
 * A negative amount converts the absolute value and keeps the same leading
 * minus as the bitcoin figure. No spot, or a spot that cannot price the
 * amount, returns `null`. `satsToFiatAmount` is unchanged.
 *
 * @param sats - Whole sats. Negative balances keep a minus.
 * @param spot - Spot and preferred fiat, or omitted.
 * @param style - Grouping style.
 * @returns The fiat string, or `null` when bitcoin should stand alone.
 */
function spotFiat(
  sats: number,
  spot: FlowSpot | undefined,
  style: NumberFormatStyle,
): string | null {
  if (spot === undefined) {
    return null;
  }
  const amount = satsToFiatAmount(sats < 0 ? -sats : sats, spot.rateDay, spot.fiat);
  if (amount === null) {
    return null;
  }
  const text = formatFiatDisplay(amount, spot.fiat, style);
  if (sats < 0) {
    return `\u2212${text}`;
  }
  return text;
}

/**
 * Bitcoin figure with the preferred fiat beside it when a spot can price it.
 *
 * @param node - Ribbon being pointed at.
 * @param style - Grouping style.
 * @param spot - Spot and preferred fiat, or omitted.
 * @returns `₿…`, or `₿… · ` plus the fiat figure.
 */
function ribbonAmount(
  node: RibbonNode,
  style: NumberFormatStyle,
  spot: FlowSpot | undefined,
): string {
  const bitcoin =
    node.kind === 'balance' ? signedSats(node.sats, style) : formatBitcoin(node.sats, style);
  const priced = spotFiat(node.sats, spot, style);
  if (priced === null) {
    return bitcoin;
  }
  return `${bitcoin} · ${priced}`;
}

/**
 * Tooltip sentence for one ribbon.
 *
 * @param node - Ribbon being pointed at.
 * @param style - Grouping style.
 * @param spot - Spot and preferred fiat, or omitted. A usable spot puts fiat
 *   beside the bitcoin figure.
 * @returns Count and sats, or a signed balance.
 */
function ribbonTip(
  node: RibbonNode,
  style: NumberFormatStyle,
  spot: FlowSpot | undefined,
): string {
  const amount = ribbonAmount(node, style, spot);
  if (node.kind === 'balance') {
    return `${node.label}: ${amount}`;
  }
  return `${node.label}: ${formatCount(node.count, style)} payments · ${amount}`;
}

/**
 * Fill class for one ribbon.
 *
 * @param node - Ribbon to paint.
 * @returns A theme fill class. Balance and fees are muted.
 */
function ribbonClass(node: RibbonNode): string {
  switch (node.kind) {
    case 'balance':
      return 'fill-paper/25';
    case 'fee':
      return 'fill-paper/40';
    case 'purpose':
      return PURPOSE_FILL_CLASS[node.purpose];
  }
}

/**
 * Adds a flow into a merged group.
 *
 * @param groups - Groups keyed by party and purpose.
 * @param party - Counterparty. Incoming uses `from`, outgoing uses `to`.
 * @param purpose - Payment purpose.
 * @param label - Visible label. It names `party`.
 * @param count - Payments to add.
 * @param sats - Sats to add.
 */
function addGroup(
  groups: Map<string, FlowGroup>,
  party: WalletParty,
  purpose: WalletPurpose,
  label: string,
  count: number,
  sats: number,
): void {
  const key = `${party}\n${purpose}`;
  const existing = groups.get(key);
  if (existing === undefined) {
    groups.set(key, { party, purpose, label, count, sats });
    return;
  }
  existing.count += count;
  existing.sats += sats;
}

/**
 * Visible purpose ribbons for the selected metric, largest first.
 *
 * @param groups - Merged groups.
 * @param metric - Amount uses sats. Count uses the payment count.
 * @returns Ribbons whose metric is above zero.
 */
function toNodes(groups: Map<string, FlowGroup>, metric: WalletFlowMetric): PurposeNode[] {
  const nodes: PurposeNode[] = [];
  for (const group of groups.values()) {
    const value = metric === 'amount' ? group.sats : group.count;
    if (value <= 0) {
      continue;
    }
    nodes.push({
      kind: 'purpose',
      purpose: group.purpose,
      key: `${group.party}:${group.purpose}`,
      label: group.label,
      count: group.count,
      sats: group.sats,
      metric: value,
    });
  }
  nodes.sort((a, b) => b.metric - a.metric);
  return nodes;
}

/**
 * Sum of ribbon metrics on one side.
 *
 * @param nodes - Ribbons on one side.
 * @returns The column total. Zero when the side is empty.
 */
function metricTotal(nodes: readonly { metric: number }[]): number {
  let total = 0;
  for (const node of nodes) {
    total += node.metric;
  }
  return total;
}

/**
 * Ribbon thicknesses on one shared scale.
 *
 * Count mode passes the larger of the two column totals, so the shorter
 * column stays shorter. Amount mode passes the total both columns share.
 * The same metric then has the same thickness on both sides.
 *
 * @param nodes - Ribbons on one side, top to bottom.
 * @param scaleTotal - Shared denominator for both columns.
 * @param budget - Pixel budget of the full scale.
 * @returns One thickness per node.
 */
function ribbonThicknesses(
  nodes: readonly { metric: number }[],
  scaleTotal: number,
  budget: number,
): number[] {
  /* v8 ignore next 3 -- a drawn diagram has a positive shared total */
  if (scaleTotal <= 0) {
    throw new Error('Missing flow scale');
  }
  return nodes.map((node) => (node.metric / scaleTotal) * budget);
}

/**
 * Vertical slot for a label. Pinned balances occupy the bottom slots.
 *
 * @param position - Index in the side's visual list.
 * @param countOnSide - How many labels that side has.
 * @param slots - Slots in the taller side.
 * @param pinnedCount - How many trailing labels are pinned to the bottom.
 * @returns Slot index from the top.
 */
function slotIndex(
  position: number,
  countOnSide: number,
  slots: number,
  pinnedCount: number,
): number {
  const firstPinned = countOnSide - pinnedCount;
  if (pinnedCount > 0 && position >= firstPinned) {
    return slots - pinnedCount + (position - firstPinned);
  }
  return position;
}

/**
 * One balance ribbon. The metric is the absolute sat value used for width.
 *
 * @param key - Stable ribbon key.
 * @param label - Visible English label.
 * @param sats - Signed balance. The tooltip keeps the sign.
 * @param metric - Absolute sats, the ribbon width.
 * @returns A muted balance node.
 */
function balanceNode(key: string, label: string, sats: number, metric: number): BalanceNode {
  return { kind: 'balance', key, label, count: 0, sats, metric };
}

/**
 * Opening and closing balance ribbons for amount mode.
 *
 * A positive start sits on the left and a positive end on the right. A
 * negative balance switches columns and uses its absolute value. A zero end
 * stays on the right with no width. Count mode draws none. Within one side
 * the earlier balance is listed first, so it sits above the later one.
 *
 * @param metric - Amount or count.
 * @param startSats - Balance at the start of the span.
 * @param endSats - Balance at the end of the span.
 * @returns The balance ribbons for each column, top to bottom.
 */
function balanceRibbons(
  metric: WalletFlowMetric,
  startSats: number,
  endSats: number,
): { left: BalanceNode[]; right: BalanceNode[] } {
  const left: BalanceNode[] = [];
  const right: BalanceNode[] = [];
  if (metric !== 'amount') {
    return { left, right };
  }
  if (startSats > 0) {
    left.push(balanceNode('start', 'Balance at start of day', startSats, startSats));
  } else if (startSats < 0) {
    right.push(balanceNode('start', 'Balance below zero at start of day', startSats, -startSats));
  }
  if (endSats > 0) {
    right.push(balanceNode('end', 'Balance at end of day', endSats, endSats));
  } else if (endSats < 0) {
    left.push(balanceNode('end', 'Balance below zero at end of day', endSats, -endSats));
  } else {
    right.push(balanceNode('end', 'Balance at end of day', 0, 0));
  }
  return { left, right };
}

/**
 * Sankey ribbon from a label to the account stack.
 *
 * @param x0 - Label-side x.
 * @param x1 - Account-side x.
 * @param yLabel - Label center.
 * @param yStack - Top of this ribbon on the account.
 * @param thickness - Ribbon thickness.
 * @returns SVG path.
 */
function ribbonPath(
  x0: number,
  x1: number,
  yLabel: number,
  yStack: number,
  thickness: number,
): string {
  const half = thickness / 2;
  const y0a = yLabel - half;
  const y0b = yLabel + half;
  const y1a = yStack;
  const y1b = yStack + thickness;
  const mid = (x0 + x1) / 2;
  return `M ${x0} ${y0a} C ${mid} ${y0a}, ${mid} ${y1a}, ${x1} ${y1a} L ${x1} ${y1b} C ${mid} ${y1b}, ${mid} ${y0b}, ${x0} ${y0b} Z`;
}

/**
 * True when the selection has nothing to draw.
 *
 * @param metric - Amount or count.
 * @param left - Incoming ribbons, before balance nodes.
 * @param right - Outgoing ribbons, before balance nodes.
 * @param startSats - Balance at the start of the span.
 * @param endSats - Balance at the end of the span.
 * @returns Whether to show the empty sentence.
 */
function selectionEmpty(
  metric: WalletFlowMetric,
  left: readonly RibbonNode[],
  right: readonly RibbonNode[],
  startSats: number,
  endSats: number,
): boolean {
  if (left.length > 0 || right.length > 0) {
    return false;
  }
  if (metric === 'count') {
    return true;
  }
  return startSats === 0 && endSats === 0;
}

/**
 * SVG flow diagram for one account.
 *
 * Three columns: where the money came from, the account, and where it went.
 * Incoming and outgoing nodes are grouped by party and purpose, and every
 * label names that party. On member wallets, "Shop sales to members" is only
 * a shop purchase from members. Both columns share one scale, so one payment
 * has the same ribbon width on each side. Count mode uses the larger column
 * total and omits fees and balances. Amount mode keeps the two sat totals
 * equal: a positive start balance sits at the bottom of the left column, a
 * negative start balance sits at the bottom of the right column with its
 * absolute value, a positive end balance sits at the bottom of the right
 * column, and a negative end balance sits at the bottom of the left column
 * with its absolute value. A usable `spot` puts the preferred fiat beside
 * every ribbon amount. Without one, the tooltip shows bitcoin alone.
 *
 * @param props - Account, flows for the selected span, balances, metric, and
 *   optional spot.
 * @returns The diagram, or "No payments on this day".
 */
export function WalletFlowDiagram({
  account,
  accountLabel,
  flows,
  startSats,
  endSats,
  metric,
  numberFormat,
  spot,
}: {
  account: 'fund' | 'members';
  accountLabel: string;
  flows: readonly WalletUsageFlow[];
  startSats: number;
  endSats: number;
  metric: WalletFlowMetric;
  numberFormat: NumberFormatStyle;
  spot?: FlowSpot;
}): ReactElement {
  const [tip, setTip] = useState<string | null>(null);
  const incoming = new Map<string, FlowGroup>();
  const outgoing = new Map<string, FlowGroup>();
  let feeSats = 0;
  let feeCount = 0;
  for (const flow of flows) {
    if (flow.to === account) {
      addGroup(
        incoming,
        flow.from,
        flow.purpose,
        incomingLabel(account, flow.from, flow.purpose),
        flow.count,
        flow.sats,
      );
    }
    if (flow.from === account) {
      addGroup(
        outgoing,
        flow.to,
        flow.purpose,
        outgoingLabel(flow.to, flow.purpose),
        flow.count,
        flow.sats,
      );
    }
    if (flow.from === account && flow.to !== account && flow.feeSats > 0) {
      feeSats += flow.feeSats;
      feeCount += flow.count;
    }
  }
  const leftPayments = toNodes(incoming, metric);
  const rightPayments: RibbonNode[] = toNodes(outgoing, metric);
  if (metric === 'amount' && feeSats > 0) {
    rightPayments.push({
      kind: 'fee',
      key: 'fee',
      label: 'Fees',
      count: feeCount,
      sats: feeSats,
      metric: feeSats,
    });
    rightPayments.sort((a, b) => b.metric - a.metric);
  }
  if (selectionEmpty(metric, leftPayments, rightPayments, startSats, endSats)) {
    return <p className="text-paper/60">No payments on this day</p>;
  }

  const balances = balanceRibbons(metric, startSats, endSats);
  const leftVisual: RibbonNode[] = [...leftPayments, ...balances.left];
  const rightVisual: RibbonNode[] = [...rightPayments, ...balances.right];
  const slots = Math.max(leftVisual.length, rightVisual.length, 1);
  const budget = slots * (MIN_SLOT - 8);
  const plotH = slots * MIN_SLOT;
  const accountTop = HEADER + (plotH - budget) / 2;
  const height = HEADER + plotH + 8;
  const centerLeft = (VIEW_W - CENTER_W) / 2;
  const centerRight = centerLeft + CENTER_W;
  const scaleTotal = Math.max(metricTotal(leftVisual), metricTotal(rightVisual));
  const leftThickness = ribbonThicknesses(leftVisual, scaleTotal, budget);
  const rightThickness = ribbonThicknesses(rightVisual, scaleTotal, budget);

  const ribbons: ReactElement[] = [];
  let leftStack = accountTop;
  for (let position = 0; position < leftVisual.length; position += 1) {
    const node = leftVisual[position];
    const thickness = leftThickness[position];
    /* v8 ignore next 3 -- position stays inside both arrays */
    if (node === undefined || thickness === undefined) {
      continue;
    }
    const slot = slotIndex(position, leftVisual.length, slots, balances.left.length);
    const labelY = HEADER + slot * MIN_SLOT + MIN_SLOT / 2;
    const text = ribbonTip(node, numberFormat, spot);
    ribbons.push(
      <g
        key={`from-${node.key}`}
        data-flow={node.label}
        data-side="from"
        tabIndex={0}
        onMouseEnter={() => {
          setTip(text);
        }}
        onMouseLeave={() => {
          setTip(null);
        }}
        onFocus={() => {
          setTip(text);
        }}
        onBlur={() => {
          setTip(null);
        }}
      >
        <path
          d={ribbonPath(LABEL_W, centerLeft, labelY, leftStack, thickness)}
          className={ribbonClass(node)}
          data-metric={node.metric}
        />
        <rect
          x={0}
          y={HEADER + slot * MIN_SLOT}
          width={LABEL_W}
          height={MIN_SLOT}
          fill="transparent"
        />
        <text
          data-column="from"
          x={LABEL_W - 8}
          y={labelY}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-paper"
          fontSize="10"
        >
          {node.label}
        </text>
      </g>,
    );
    leftStack += thickness;
  }
  let rightStack = accountTop;
  for (let position = 0; position < rightVisual.length; position += 1) {
    const node = rightVisual[position];
    const thickness = rightThickness[position];
    /* v8 ignore next 3 -- position stays inside both arrays */
    if (node === undefined || thickness === undefined) {
      continue;
    }
    const slot = slotIndex(position, rightVisual.length, slots, balances.right.length);
    const labelY = HEADER + slot * MIN_SLOT + MIN_SLOT / 2;
    const text = ribbonTip(node, numberFormat, spot);
    ribbons.push(
      <g
        key={`to-${node.key}`}
        data-flow={node.label}
        data-side="to"
        tabIndex={0}
        onMouseEnter={() => {
          setTip(text);
        }}
        onMouseLeave={() => {
          setTip(null);
        }}
        onFocus={() => {
          setTip(text);
        }}
        onBlur={() => {
          setTip(null);
        }}
      >
        <path
          d={ribbonPath(centerRight, VIEW_W - LABEL_W, labelY, rightStack, thickness)}
          className={ribbonClass(node)}
          data-metric={node.metric}
        />
        <rect
          x={VIEW_W - LABEL_W}
          y={HEADER + slot * MIN_SLOT}
          width={LABEL_W}
          height={MIN_SLOT}
          fill="transparent"
        />
        <text
          data-column="to"
          x={VIEW_W - LABEL_W + 8}
          y={labelY}
          textAnchor="start"
          dominantBaseline="middle"
          className="fill-paper"
          fontSize="10"
        >
          {node.label}
        </text>
      </g>,
    );
    rightStack += thickness;
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={accountLabel}
        overflow="hidden"
      >
        <text x={8} y={14} className="fill-paper/60" fontSize="11">
          Where from
        </text>
        <text x={VIEW_W - 8} y={14} textAnchor="end" className="fill-paper/60" fontSize="11">
          Where to
        </text>
        {ribbons}
        <rect
          x={centerLeft}
          y={accountTop}
          width={CENTER_W}
          height={budget}
          rx={12}
          className="fill-paper/10"
        />
        <text
          x={VIEW_W / 2}
          y={accountTop + budget / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-paper"
          fontSize="12"
        >
          {accountLabel}
        </text>
      </svg>
      <p role="status" className="mt-2 min-h-6 text-sm text-paper/80">
        {tip === null ? '' : tip}
      </p>
    </div>
  );
}
