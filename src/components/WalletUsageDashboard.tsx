'use client';

import { useState, type ReactElement } from 'react';
import { FilterMenu } from '@/app/(marketing)/FilterMenu';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { formatCount, OverTimeChart } from '@/components/StatsDashboard';
import { SegmentedControl } from '@/components/ui';
import {
  accountBalances,
  PARTY_LABEL,
  PURPOSE_FILL_CLASS,
  PURPOSE_LABEL,
  PURPOSE_SWATCH_CLASS,
  WalletFlowDiagram,
  type AccountBalanceDay,
  type WalletFlowMetric,
} from '@/components/WalletFlowDiagram';
import { useSpotRate } from '@/hooks/useSpotRate';
import {
  WALLET_PURPOSES,
  type WalletParty,
  type WalletPurpose,
  type WalletStats,
  type WalletUsage,
  type WalletUsageDay,
  type WalletUsageFlow,
} from '@/lib/api-types';
import { formatGroupedNumber, type NumberFormatStyle } from '@/lib/number-format';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

const CHART_W = 800;
const CHART_H = 240;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;

const WALLET_W = 800;
const WALLET_H = 280;
const WALLET_PAD_L = 96;
const WALLET_PAD_R = 16;
const WALLET_PAD_T = 16;
const WALLET_PAD_B = 36;

type ForumPace = {
  beforeRate: number | null;
  afterRate: number | null;
  compare: 'omit' | 'zero-before' | number;
};

type FlowTableRow = {
  from: WalletParty;
  to: WalletParty;
  purpose: WalletPurpose;
  count: number;
  sats: number;
  feeSats: number;
};

/**
 * English month name for a UTC month index.
 *
 * @param monthIndex - `Date#getUTCMonth` value, 0 through 11.
 * @returns The month name.
 */
function monthName(monthIndex: number): string {
  switch (monthIndex) {
    case 0:
      return 'January';
    case 1:
      return 'February';
    case 2:
      return 'March';
    case 3:
      return 'April';
    case 4:
      return 'May';
    case 5:
      return 'June';
    case 6:
      return 'July';
    case 7:
      return 'August';
    case 8:
      return 'September';
    case 9:
      return 'October';
    case 10:
      return 'November';
    case 11:
      return 'December';
    /* v8 ignore next 2 -- Date#getUTCMonth only returns 0 through 11 */
    default:
      throw new Error('Invalid month');
  }
}

/**
 * Two-digit UTC clock part.
 *
 * @param value - Hour or minute.
 * @returns Zero-padded when below 10.
 */
function twoDigits(value: number): string {
  const whole = Math.trunc(Math.abs(value));
  if (whole < 10) {
    return `0${whole}`;
  }
  return String(whole);
}

/**
 * Formats an ISO instant as "9 November 2026, 11:17 UTC".
 *
 * @param iso - Timestamp from the payload.
 * @returns The label, or `null` when `iso` is not a time.
 */
function formatInstant(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return null;
  }
  const date = new Date(ms);
  return `${date.getUTCDate()} ${monthName(date.getUTCMonth())} ${date.getUTCFullYear()}, ${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())} UTC`;
}

/**
 * UTC day of the release instant.
 *
 * @param releasedAt - Release timestamp.
 * @returns `YYYY-MM-DD`, or `null` when the timestamp does not parse.
 */
function releaseDay(releasedAt: string): string | null {
  const label = formatInstant(releasedAt);
  if (label === null) {
    return null;
  }
  const ms = Date.parse(releasedAt);
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * First sentence of the subtitle.
 *
 * @param releasedAt - Release timestamp, shown raw when it is not a time.
 * @returns The release sentence.
 */
function releasedSentence(releasedAt: string): string {
  const label = formatInstant(releasedAt);
  if (label === null) {
    return releasedAt;
  }
  return `Released ${label}.`;
}

/**
 * Second sentence of the subtitle.
 *
 * @param asOf - Payload as-of time, or `null`.
 * @returns The as-of sentence, or the raw string when it is not a time.
 */
function asOfSentence(asOf: string | null): string {
  if (asOf === null) {
    return 'Figures have no as-of time.';
  }
  const label = formatInstant(asOf);
  if (label === null) {
    return asOf;
  }
  return `As of ${label}.`;
}

/**
 * Forum payments per day before and after the release day.
 *
 * Payments are gifts plus hearts. Days before the release UTC day are the
 * earlier pace. A zero earlier pace is reported on its own so the page does
 * not divide by zero.
 *
 * @param usage - Loaded usage payload.
 * @returns Rates and the takeaway comparison.
 */
function forumPace(usage: WalletUsage): ForumPace {
  const released = releaseDay(usage.releasedAt);
  if (released === null) {
    return { beforeRate: null, afterRate: null, compare: 'omit' };
  }
  let beforeSum = 0;
  let beforeDays = 0;
  let afterSum = 0;
  let afterDays = 0;
  for (const row of usage.forum) {
    const payments = row.gifts + row.hearts;
    if (row.day < released) {
      beforeSum += payments;
      beforeDays += 1;
    } else {
      afterSum += payments;
      afterDays += 1;
    }
  }
  const beforeRate = beforeDays === 0 ? null : beforeSum / beforeDays;
  const afterRate = afterDays === 0 ? null : afterSum / afterDays;
  if (beforeRate === null || afterRate === null) {
    return { beforeRate, afterRate, compare: 'omit' };
  }
  if (beforeRate === 0) {
    return { beforeRate, afterRate, compare: 'zero-before' };
  }
  return { beforeRate, afterRate, compare: Math.round(afterRate / beforeRate) };
}

/**
 * Groups a per-day rate. Integers stay whole. Other rates show one decimal.
 *
 * @param rate - Payments per day.
 * @param style - Grouping style.
 * @returns The grouped rate.
 */
function formatRate(rate: number, style: NumberFormatStyle): string {
  if (Number.isInteger(rate)) {
    return formatCount(rate, style);
  }
  return formatGroupedNumber(rate, style, 1);
}

/**
 * Takeaway built from the loaded totals and the forum pace.
 *
 * @param usage - Loaded usage payload.
 * @param style - Grouping style.
 * @returns One or two sentences.
 */
function takeawayText(usage: WalletUsage, style: NumberFormatStyle): string {
  const pace = forumPace(usage);
  const base = `${formatCount(usage.totals.paymentCount, style)} payments since the release, from ${formatCount(usage.totals.activeWalletCount, style)} active wallets.`;
  if (pace.compare === 'omit') {
    return base;
  }
  if (pace.compare === 'zero-before') {
    return `${base} The forum had no payments per day before the release.`;
  }
  return `${base} The forum is paid ${formatCount(pace.compare, style)} times as often per day as in the 28 days before.`;
}

/**
 * Forum tile text. An em dash when either side has no days.
 *
 * @param pace - Result of {@link forumPace}.
 * @param style - Grouping style.
 * @returns "after · before", or an em dash.
 */
function forumTile(pace: ForumPace, style: NumberFormatStyle): string {
  if (pace.beforeRate === null || pace.afterRate === null) {
    return '\u2014';
  }
  return `${formatRate(pace.afterRate, style)} after \u00b7 ${formatRate(pace.beforeRate, style)} before`;
}

/**
 * Bitcoin with a unicode minus when the balance is negative.
 *
 * @param sats - Whole sats.
 * @param style - Grouping style.
 * @returns The signed amount.
 */
function signedBitcoin(sats: number, style: NumberFormatStyle): string {
  if (sats < 0) {
    return `\u2212${formatBitcoin(-sats, style)}`;
  }
  return formatBitcoin(sats, style);
}

/**
 * All-days balance, or zeros when there is no day.
 *
 * @param rows - Daily balances in order.
 * @returns The first start and the last end.
 */
function spanOf(rows: readonly AccountBalanceDay[]): { startSats: number; endSats: number } {
  if (rows.length === 0) {
    return { startSats: 0, endSats: 0 };
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  /* v8 ignore next 3 -- a non-empty list has both ends */
  if (first === undefined || last === undefined) {
    throw new Error('Missing balance row');
  }
  return { startSats: first.startSats, endSats: last.endSats };
}

/**
 * Balance span for the day selector. "All days" uses the whole run.
 *
 * @param rows - Daily balances in order.
 * @param dayKey - `all` or a UTC day.
 * @returns Start and end sats for the diagrams.
 */
function chosenSpan(
  rows: readonly AccountBalanceDay[],
  dayKey: string,
): { startSats: number; endSats: number } {
  let span = spanOf(rows);
  if (dayKey === 'all') {
    return span;
  }
  for (const row of rows) {
    if (row.day === dayKey) {
      span = { startSats: row.startSats, endSats: row.endSats };
    }
  }
  return span;
}

/**
 * One row per UTC day, oldest first. A repeated day keeps the first row.
 *
 * @param days - Usage days in payload order.
 * @returns The rows for the balances, the day selector, the diagrams, and the
 *   active-wallet bars.
 */
function uniqueDays(days: readonly WalletUsageDay[]): WalletUsageDay[] {
  const seen = new Set<string>();
  const unique: WalletUsageDay[] = [];
  for (const day of days) {
    if (seen.has(day.day)) {
      continue;
    }
    seen.add(day.day);
    unique.push(day);
  }
  unique.sort((a, b) => a.day.localeCompare(b.day));
  return unique;
}

/**
 * Flows for the diagrams. "All days" keeps flows whose day is in `days`.
 * The table always uses every flow, including days outside that list.
 *
 * @param flows - All flows.
 * @param dayKey - `all` or a UTC day.
 * @param days - Days the selector and the balances use.
 * @returns The flows to draw.
 */
function flowsForDay(
  flows: readonly WalletUsageFlow[],
  dayKey: string,
  days: readonly { day: string }[],
): WalletUsageFlow[] {
  const allowed = new Set<string>();
  for (const day of days) {
    allowed.add(day.day);
  }
  const selected: WalletUsageFlow[] = [];
  for (const flow of flows) {
    if (!allowed.has(flow.day)) {
      continue;
    }
    if (dayKey !== 'all' && flow.day !== dayKey) {
      continue;
    }
    selected.push(flow);
  }
  return selected;
}

/**
 * Merges flows for the table and drops rows that moved nothing.
 *
 * @param flows - All flows, including days outside the selector.
 * @returns Rows sorted by sats, largest first.
 */
function aggregateFlows(flows: readonly WalletUsageFlow[]): FlowTableRow[] {
  const grouped = new Map<string, FlowTableRow>();
  for (const flow of flows) {
    const key = `${flow.from}|${flow.to}|${flow.purpose}`;
    const existing = grouped.get(key);
    if (existing === undefined) {
      grouped.set(key, {
        from: flow.from,
        to: flow.to,
        purpose: flow.purpose,
        count: flow.count,
        sats: flow.sats,
        feeSats: flow.feeSats,
      });
    } else {
      existing.count += flow.count;
      existing.sats += flow.sats;
      existing.feeSats += flow.feeSats;
    }
  }
  const rows: FlowTableRow[] = [];
  for (const row of grouped.values()) {
    if (row.count + row.sats + row.feeSats === 0) {
      continue;
    }
    rows.push(row);
  }
  rows.sort((a, b) => b.sats - a.sats);
  return rows;
}

/**
 * Manila hour counts for hours 0 through 23. Each row is added at
 * `(hourUtc + 8) % 24`. Duplicate hours are summed. A missing hour is 0.
 *
 * @param hours - UTC hour rows from the payload.
 * @returns All 24 bars, from midnight Manila time.
 */
function manilaHours(
  hours: readonly { hourUtc: number; count: number }[],
): { hour: number; count: number }[] {
  const bars: { hour: number; count: number }[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    let count = 0;
    for (const row of hours) {
      if ((row.hourUtc + 8) % 24 === hour) {
        count += row.count;
      }
    }
    bars.push({ hour, count });
  }
  return bars;
}

/**
 * X-axis label indexes. Dense series keep the first, middle, and last day.
 *
 * @param count - Number of bars.
 * @returns Indexes to label. One index when there is a single bar.
 */
function labelIndexes(count: number): number[] {
  if (count <= 1) {
    return [0];
  }
  if (count === 2) {
    return [0, 1];
  }
  return [0, Math.floor((count - 1) / 2), count - 1];
}

/**
 * Anchor for an x-axis label so the first and last stay inside the chart.
 *
 * @param tickIndex - Index among the visible labels.
 * @param count - How many labels are visible.
 * @returns SVG text anchor.
 */
function tickAnchor(tickIndex: number, count: number): 'start' | 'middle' | 'end' {
  if (count > 1 && tickIndex === 0) {
    return 'start';
  }
  if (count > 1 && tickIndex === count - 1) {
    return 'end';
  }
  return 'middle';
}

/**
 * Empty chart with an accessible name.
 *
 * @param label - Accessible chart name.
 * @param testId - Test id.
 * @returns An empty SVG.
 */
function emptyChart(label: string, testId: string): ReactElement {
  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
      data-testid={testId}
    />
  );
}

/**
 * X position of a bar slot.
 *
 * @param index - Bar index.
 * @param count - Bar count.
 * @returns Left x of the slot.
 */
function slotX(index: number, count: number): number {
  const innerW = CHART_W - PAD_L - PAD_R;
  return PAD_L + index * (innerW / count);
}

/**
 * Colour legend.
 *
 * @param props - Legend props.
 * @param props.items - Swatch and label pairs.
 * @returns A wrapping list.
 */
function SwatchLegend({
  items,
}: {
  readonly items: readonly { label: string; swatch: string }[];
}): ReactElement {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-paper/80">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={`inline-block h-3 w-3 ${item.swatch}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * X of the release line. `null` when the release time does not parse.
 *
 * @param days - Chart days, oldest first.
 * @param release - Release UTC day, or `null`.
 * @returns The line x, or `null`.
 */
function releaseLineX(days: readonly string[], release: string | null): number | null {
  if (release === null) {
    return null;
  }
  const innerW = CHART_W - PAD_L - PAD_R;
  const slot = innerW / days.length;
  let index = days.length;
  let i = 0;
  for (const day of days) {
    if (day >= release) {
      index = i;
      break;
    }
    i += 1;
  }
  return PAD_L + index * slot;
}

/**
 * Stacked payments per UTC day, one colour per purpose.
 *
 * @param days - Usage days.
 * @param style - Grouping style for the tooltip.
 * @param rateDay - Current spot, or `null`.
 * @param fiat - Preferred code.
 * @returns The chart and its legend.
 */
function PurposeChart(
  days: readonly WalletUsageDay[],
  style: NumberFormatStyle,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
): ReactElement {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const label = 'Payments per day by purpose';
  if (sorted.length === 0) {
    return emptyChart(label, 'purpose-chart');
  }
  const purposesUsed: WalletPurpose[] = [];
  for (const purpose of WALLET_PURPOSES) {
    for (const day of sorted) {
      if (day.purposes[purpose].sats > 0) {
        purposesUsed.push(purpose);
        break;
      }
    }
  }
  let maxSats = 0;
  for (const day of sorted) {
    let total = 0;
    for (const purpose of purposesUsed) {
      total += day.purposes[purpose].sats;
    }
    if (total > maxSats) {
      maxSats = total;
    }
  }
  const scale = Math.max(maxSats, 1);
  const innerH = CHART_H - PAD_T - PAD_B;
  const innerW = CHART_W - PAD_L - PAD_R;
  const slot = innerW / sorted.length;
  const barW = slot * 0.7;
  const base = PAD_T + innerH;
  const indexes = labelIndexes(sorted.length);
  return (
    <div className="space-y-3">
      <SwatchLegend
        items={purposesUsed.map((purpose) => ({
          label: PURPOSE_LABEL[purpose],
          swatch: PURPOSE_SWATCH_CLASS[purpose],
        }))}
      />
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
        data-testid="purpose-chart"
      >
        {sorted.map((day, index) => {
          const parts: string[] = [];
          const rects: ReactElement[] = [];
          let stacked = 0;
          for (const purpose of purposesUsed) {
            const cell = day.purposes[purpose];
            const priced = bitcoinWithFiat(cell.sats, rateDay, fiat, style);
            parts.push(`${PURPOSE_LABEL[purpose]}: ${formatCount(cell.count, style)} / ${priced}`);
            if (cell.sats <= 0) {
              continue;
            }
            const barH = (cell.sats / scale) * innerH;
            stacked += barH;
            rects.push(
              <rect
                key={purpose}
                x={slotX(index, sorted.length) + (slot - barW) / 2}
                y={base - stacked}
                width={barW}
                height={barH}
                className={PURPOSE_FILL_CLASS[purpose]}
              />,
            );
          }
          return (
            <g key={day.day}>
              {rects}
              <rect
                x={slotX(index, sorted.length)}
                y={PAD_T}
                width={slot}
                height={innerH}
                fill="transparent"
              >
                <title>{`${day.day}: ${parts.join(', ')}`}</title>
              </rect>
            </g>
          );
        })}
        {indexes.map((index, tickIndex) => {
          const day = sorted[index];
          /* v8 ignore next 3 -- label indexes stay inside the series */
          if (day === undefined) {
            return null;
          }
          return (
            <text
              key={day.day}
              x={slotX(index, sorted.length) + slot / 2}
              y={CHART_H - 12}
              textAnchor={tickAnchor(tickIndex, indexes.length)}
              className="fill-paper/50"
              fontSize="12"
            >
              {day.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Stacked forum gifts and hearts, with a line on the release day.
 *
 * @param usage - Loaded usage payload.
 * @param style - Grouping style for the tooltip.
 * @param rateDay - Current spot, or `null`.
 * @param fiat - Preferred code.
 * @returns The chart.
 */
function ForumChart(
  usage: WalletUsage,
  style: NumberFormatStyle,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
): ReactElement {
  const sorted = [...usage.forum].sort((a, b) => a.day.localeCompare(b.day));
  const label = 'Forum payments before and after the release';
  if (sorted.length === 0) {
    return emptyChart(label, 'forum-chart');
  }
  let maxPayments = 0;
  for (const row of sorted) {
    const total = row.gifts + row.hearts;
    if (total > maxPayments) {
      maxPayments = total;
    }
  }
  const scale = Math.max(maxPayments, 1);
  const innerH = CHART_H - PAD_T - PAD_B;
  const innerW = CHART_W - PAD_L - PAD_R;
  const slot = innerW / sorted.length;
  const barW = slot * 0.7;
  const base = PAD_T + innerH;
  const lineX = releaseLineX(
    sorted.map((row) => row.day),
    releaseDay(usage.releasedAt),
  );
  const indexes = labelIndexes(sorted.length);
  return (
    <div className="space-y-3">
      <SwatchLegend
        items={[
          { label: 'Gifts', swatch: 'bg-accent' },
          { label: 'Hearts', swatch: 'bg-home-reply' },
        ]}
      />
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
        data-testid="forum-chart"
      >
        {sorted.map((row, index) => {
          const giftH = row.gifts > 0 ? (row.gifts / scale) * innerH : 0;
          const heartH = row.hearts > 0 ? (row.hearts / scale) * innerH : 0;
          const x = slotX(index, sorted.length) + (slot - barW) / 2;
          const gifts = formatCount(row.gifts, style);
          const hearts = formatCount(row.hearts, style);
          const priced = bitcoinWithFiat(row.sats, rateDay, fiat, style);
          return (
            <g key={row.day}>
              {row.gifts > 0 ? (
                <rect x={x} y={base - giftH} width={barW} height={giftH} className="fill-accent" />
              ) : null}
              {row.hearts > 0 ? (
                <rect
                  x={x}
                  y={base - giftH - heartH}
                  width={barW}
                  height={heartH}
                  className="fill-home-reply"
                />
              ) : null}
              <rect
                x={slotX(index, sorted.length)}
                y={PAD_T}
                width={slot}
                height={innerH}
                fill="transparent"
              >
                <title>{`${row.day}: ${gifts} gifts, ${hearts} hearts, ${priced}`}</title>
              </rect>
            </g>
          );
        })}
        {lineX === null ? null : (
          <line
            data-testid="release-line"
            x1={lineX}
            x2={lineX}
            y1={PAD_T}
            y2={base}
            className="stroke-paper"
            strokeWidth="1.5"
          />
        )}
        {indexes.map((index, tickIndex) => {
          const row = sorted[index];
          /* v8 ignore next 3 -- label indexes stay inside the series */
          if (row === undefined) {
            return null;
          }
          return (
            <text
              key={row.day}
              x={slotX(index, sorted.length) + slot / 2}
              y={CHART_H - 12}
              textAnchor={tickAnchor(tickIndex, indexes.length)}
              className="fill-paper/50"
              fontSize="12"
            >
              {row.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Shop till charges. Created is a muted bar. Paid is drawn on top of it.
 *
 * @param usage - Loaded usage payload.
 * @param style - Grouping style for the tooltip.
 * @returns The chart.
 */
function ShopChart(usage: WalletUsage, style: NumberFormatStyle): ReactElement {
  const sorted = [...usage.shopCharges].sort((a, b) => a.day.localeCompare(b.day));
  const label = 'Shop till: charges created and paid';
  if (sorted.length === 0) {
    return emptyChart(label, 'shop-chart');
  }
  let maxCount = 0;
  for (const row of sorted) {
    if (row.created > maxCount) {
      maxCount = row.created;
    }
    if (row.paid > maxCount) {
      maxCount = row.paid;
    }
  }
  const scale = Math.max(maxCount, 1);
  const innerH = CHART_H - PAD_T - PAD_B;
  const innerW = CHART_W - PAD_L - PAD_R;
  const slot = innerW / sorted.length;
  const barW = slot * 0.7;
  const base = PAD_T + innerH;
  const lineX = releaseLineX(
    sorted.map((row) => row.day),
    releaseDay(usage.releasedAt),
  );
  const indexes = labelIndexes(sorted.length);
  return (
    <div className="space-y-3">
      <SwatchLegend
        items={[
          { label: 'Created', swatch: 'bg-paper/25' },
          { label: 'Paid', swatch: 'bg-accent' },
        ]}
      />
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
        data-testid="shop-chart"
      >
        {sorted.map((row, index) => {
          const x = slotX(index, sorted.length) + (slot - barW) / 2;
          const createdH = (row.created / scale) * innerH;
          const paidH = (row.paid / scale) * innerH;
          return (
            <g key={row.day}>
              {row.created > 0 ? (
                <rect
                  x={x}
                  y={base - createdH}
                  width={barW}
                  height={createdH}
                  className="fill-paper/25"
                />
              ) : null}
              {row.paid > 0 ? (
                <rect
                  x={x + barW * 0.15}
                  y={base - paidH}
                  width={barW * 0.7}
                  height={paidH}
                  className="fill-accent"
                />
              ) : null}
              <rect
                x={slotX(index, sorted.length)}
                y={PAD_T}
                width={slot}
                height={innerH}
                fill="transparent"
              >
                <title>
                  {`${row.day}: ${formatCount(row.created, style)} created, ${formatCount(row.paid, style)} paid`}
                </title>
              </rect>
            </g>
          );
        })}
        {lineX === null ? null : (
          <line
            data-testid="release-line"
            x1={lineX}
            x2={lineX}
            y1={PAD_T}
            y2={base}
            className="stroke-paper"
            strokeWidth="1.5"
          />
        )}
        {indexes.map((index, tickIndex) => {
          const row = sorted[index];
          /* v8 ignore next 3 -- label indexes stay inside the series */
          if (row === undefined) {
            return null;
          }
          return (
            <text
              key={row.day}
              x={slotX(index, sorted.length) + slot / 2}
              y={CHART_H - 12}
              textAnchor={tickAnchor(tickIndex, indexes.length)}
              className="fill-paper/50"
              fontSize="12"
            >
              {row.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Payment-size bars with a count label and a sats tooltip.
 *
 * @param usage - Loaded usage payload.
 * @param style - Grouping style.
 * @param rateDay - Current spot, or `null`.
 * @param fiat - Preferred code.
 * @returns The chart.
 */
function SizeChart(
  usage: WalletUsage,
  style: NumberFormatStyle,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
): ReactElement {
  const buckets = [...usage.amountBuckets].sort((a, b) => a.minSats - b.minSats);
  const label = 'Payment sizes';
  if (buckets.length === 0) {
    return emptyChart(label, 'size-chart');
  }
  let maxCount = 0;
  for (const bucket of buckets) {
    if (bucket.count > maxCount) {
      maxCount = bucket.count;
    }
  }
  const scale = Math.max(maxCount, 1);
  const innerH = CHART_H - PAD_T - PAD_B;
  const innerW = CHART_W - PAD_L - PAD_R;
  const slot = innerW / buckets.length;
  const barW = slot * 0.7;
  const base = PAD_T + innerH;
  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
      data-testid="size-chart"
    >
      {buckets.map((bucket, index) => {
        const barH = (bucket.count / scale) * innerH;
        const x = slotX(index, buckets.length) + (slot - barW) / 2;
        return (
          <g key={bucket.key}>
            <rect x={x} y={base - barH} width={barW} height={barH} className="fill-accent">
              <title>
                {`${bucket.key}: ${bitcoinWithFiat(bucket.sats, rateDay, fiat, style)}`}
              </title>
            </rect>
            <text
              x={x + barW / 2}
              y={base - barH - 6}
              textAnchor="middle"
              className="fill-paper"
              fontSize="12"
            >
              {formatCount(bucket.count, style)}
            </text>
            <text
              x={x + barW / 2}
              y={CHART_H - 12}
              textAnchor="middle"
              className="fill-paper/50"
              fontSize="12"
            >
              {bucket.key}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Payments by Manila hour (UTC+8), sorted from 0 to 23.
 *
 * @param usage - Loaded usage payload.
 * @param style - Grouping style for the tooltip.
 * @returns The chart.
 */
function HourChart(usage: WalletUsage, style: NumberFormatStyle): ReactElement {
  const bars = manilaHours(usage.hours);
  const label = 'Time of day (Manila, UTC+8)';
  let maxCount = 0;
  for (const bar of bars) {
    if (bar.count > maxCount) {
      maxCount = bar.count;
    }
  }
  const scale = Math.max(maxCount, 1);
  const innerH = CHART_H - PAD_T - PAD_B;
  const innerW = CHART_W - PAD_L - PAD_R;
  const slot = innerW / bars.length;
  const barW = slot * 0.7;
  const base = PAD_T + innerH;
  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
      data-testid="manila-chart"
    >
      {bars.map((bar, index) => {
        const barH = (bar.count / scale) * innerH;
        const x = PAD_L + index * slot + (slot - barW) / 2;
        return (
          <g key={bar.hour}>
            <rect x={x} y={base - barH} width={barW} height={barH} className="fill-accent">
              <title>{`${bar.hour}: ${formatCount(bar.count, style)}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={CHART_H - 12}
              textAnchor={tickAnchor(index, bars.length)}
              className="fill-paper/50"
              fontSize="10"
            >
              {bar.hour}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Wallet-stats days from the release day onward.
 *
 * @param usage - Loaded usage payload.
 * @param wallets - Wallet stats, or `null` when that fetch failed.
 * @returns The filtered series. Empty hides the section.
 */
function walletSeries(
  usage: WalletUsage,
  wallets: WalletStats | null,
): WalletStats['balanceOverTime'] {
  if (wallets === null) {
    return [];
  }
  const released = releaseDay(usage.releasedAt);
  if (released === null) {
    return [];
  }
  const points: WalletStats['balanceOverTime'] = [];
  for (const point of wallets.balanceOverTime) {
    if (point.day >= released) {
      points.push(point);
    }
  }
  return points;
}

/**
 * Wallets with a balance as a line, and active wallets as bars behind it.
 * The bars use the first usage row of each UTC day, the same rows as the
 * purpose chart.
 *
 * @param props - Usage, wallet stats, and the number format.
 * @returns The section, or `null` when there is nothing to draw.
 */
function WalletsPerDay({
  usage,
  wallets,
  numberFormat,
}: {
  usage: WalletUsage;
  wallets: WalletStats | null;
  numberFormat: NumberFormatStyle;
}): ReactElement | null {
  const series = walletSeries(usage, wallets);
  if (series.length === 0) {
    return null;
  }
  const activeByDay = new Map<string, number>();
  for (const day of uniqueDays(usage.days)) {
    activeByDay.set(day.day, day.activeWalletCount);
  }
  const n = series.length;
  const innerW = WALLET_W - WALLET_PAD_L - WALLET_PAD_R;
  const innerH = WALLET_H - WALLET_PAD_T - WALLET_PAD_B;
  const xAt = (index: number): number =>
    WALLET_PAD_L + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW);
  const step = n <= 1 ? innerW : innerW / (n - 1);
  const barW = n <= 1 ? innerW * 0.2 : step * 0.45;
  let maxActive = 0;
  for (const point of series) {
    const active = activeByDay.get(point.day);
    if (active !== undefined && active > maxActive) {
      maxActive = active;
    }
  }
  const scale = maxActive === 0 ? 1 : maxActive;
  const base = WALLET_PAD_T + innerH;
  return (
    <section className="space-y-3" aria-label="Wallets per day">
      <h2 className="text-lg font-semibold">Wallets per day</h2>
      <p className="text-sm text-paper/60">
        The line is wallets with a balance, on the axis scale. The bars are wallets active that day,
        on their own scale.
      </p>
      <ul className="flex flex-wrap gap-4 text-sm text-paper/80">
        <li className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-accent" aria-hidden="true" />
          Wallets with a balance
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 bg-paper/40" aria-hidden="true" />
          Active that day
        </li>
      </ul>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WALLET_W} ${WALLET_H}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          data-testid="wallet-active-bars"
        >
          {series.map((point, index) => {
            const active = activeByDay.get(point.day);
            if (active === undefined || active <= 0) {
              return null;
            }
            const barH = (active / scale) * innerH;
            return (
              <rect
                key={point.day}
                x={xAt(index) - barW / 2}
                y={base - barH}
                width={barW}
                height={barH}
                className="fill-paper/40"
              />
            );
          })}
        </svg>
        {OverTimeChart(
          series.map((point) => ({ day: point.day, value: point.fundedWalletCount })),
          (value) => formatCount(value, numberFormat),
          'Wallets per day',
          ({ point, x, y, hitX, hitWidth, top, height }) => {
            const active = activeByDay.get(point.day);
            const activeText =
              active === undefined ? '' : ` · ${formatCount(active, numberFormat)} active`;
            return (
              <g key={point.day}>
                <rect x={hitX} y={top} width={hitWidth} height={height} fill="transparent">
                  <title>
                    {`${point.day}: ${formatCount(point.value, numberFormat)} with a balance${activeText}`}
                  </title>
                </rect>
                {point.value > 0 ? (
                  <circle cx={x} cy={y} r={3.5} className="fill-accent" pointerEvents="none" />
                ) : null}
              </g>
            );
          },
        )}
      </div>
    </section>
  );
}

/**
 * Bitcoin figure with the preferred fiat beside it when a spot can price it.
 *
 * @param sats - Whole sats.
 * @param rateDay - Current spot, or `null`.
 * @param fiat - Preferred code.
 * @param style - Grouping style.
 * @returns `₿…`, or `₿… · ` plus {@link fiatLine}.
 */
function bitcoinWithFiat(
  sats: number,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
  style: NumberFormatStyle,
): string {
  const bitcoin = formatBitcoin(sats, style);
  const priced = fiatLine(sats, rateDay, fiat, style);
  if (priced === null) {
    return bitcoin;
  }
  return `${bitcoin} · ${priced}`;
}

/**
 * Preferred-fiat line for a sat amount, or `null` when no spot is available.
 *
 * A negative amount converts the absolute value and keeps the same leading
 * minus as the bitcoin figure. `satsToFiatAmount` itself is unchanged and
 * still refuses a negative input.
 *
 * @param sats - Whole sats. Negative balances keep a minus.
 * @param rateDay - Current spot, or `null`.
 * @param fiat - Preferred code.
 * @param style - Grouping style.
 * @returns The fiat string, or `null` when no spot can price it.
 */
function fiatLine(
  sats: number,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
  style: NumberFormatStyle,
): string | null {
  const amount = satsToFiatAmount(sats < 0 ? -sats : sats, rateDay, fiat);
  if (amount === null) {
    return null;
  }
  const text = formatFiatDisplay(amount, fiat, style);
  if (sats < 0) {
    return `\u2212${text}`;
  }
  return text;
}

/**
 * Public wallet-usage body: headline figures, charts, flow diagrams, and the
 * all-flows table.
 *
 * Body copy stays English, like `/stats`. A failed usage payload is one quiet
 * line. Missing wallet stats only hides the wallets-per-day chart. The volume
 * and fund tiles, the purpose, forum and payment-size tooltips, the all-flows
 * sats and fee cells, and every ribbon tooltip show the preferred fiat beside
 * the bitcoin figure when a spot exists, and bitcoin alone when it does not.
 * Active-wallet bars use the first row of each UTC day. Below 520 px each
 * flow diagram is the stacked lists. Below the sm breakpoint, All flows is
 * one stacked entry per flow instead of the six-column table.
 *
 * @param props - Usage, wallet stats, and the loader flags.
 * @returns The page body.
 */
export function WalletUsageDashboard({
  usage,
  wallets,
  error,
  loading,
}: {
  usage: WalletUsage | null;
  wallets: WalletStats | null;
  error: string | null;
  loading: boolean;
}): ReactElement {
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate(usage !== null);
  const [dayKey, setDayKey] = useState('all');
  const [metric, setMetric] = useState<WalletFlowMetric>('amount');

  if (loading && usage === null && error === null) {
    return <p className="text-paper/60">Loading…</p>;
  }
  if (error !== null && usage === null) {
    return <p className="text-paper/80">{error}</p>;
  }
  if (usage === null) {
    return <p className="text-paper/60">Loading…</p>;
  }

  const pace = forumPace(usage);
  const orderedDays = uniqueDays(usage.days);
  const fundRows = accountBalances('fund', orderedDays, usage.flows);
  const memberRows = accountBalances('members', orderedDays, usage.flows);
  const fundSpan = spanOf(fundRows);
  const diagramFlows = flowsForDay(usage.flows, dayKey, orderedDays);
  const fundChoice = chosenSpan(fundRows, dayKey);
  const memberChoice = chosenSpan(memberRows, dayKey);
  const volumeFiat = fiatLine(usage.totals.volumeSats, rateDay, fiat, numberFormat);
  const fundFiat = fiatLine(fundSpan.endSats, rateDay, fiat, numberFormat);
  const tableRows = aggregateFlows(usage.flows);

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <p className="text-lg text-paper/60">
          {releasedSentence(usage.releasedAt)} {asOfSentence(usage.asOf)}
        </p>
        <p className="text-lg">{takeawayText(usage, numberFormat)}</p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Payments</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {formatCount(usage.totals.paymentCount, numberFormat)}
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Volume</dt>
          <dd className="mt-2 tabular-nums lining-nums">
            <div className="text-2xl font-semibold">
              {formatBitcoin(usage.totals.volumeSats, numberFormat)}
            </div>
            {volumeFiat === null ? null : (
              <div className="text-2xl font-semibold">{volumeFiat}</div>
            )}
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Wallets</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {wallets === null ? null : (
              <div>{formatCount(wallets.fundedWalletCount, numberFormat)} with a balance</div>
            )}
            <div>{formatCount(usage.totals.sendingWalletCount, numberFormat)} sending</div>
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Forum payments per day</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {forumTile(pace, numberFormat)}
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Paid till charges</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {formatCount(usage.totals.paidShopChargeCount, numberFormat)}
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Tondo fund balance</dt>
          <dd className="mt-2 tabular-nums lining-nums">
            <div className="text-2xl font-semibold">
              {signedBitcoin(fundSpan.endSats, numberFormat)}
            </div>
            {fundFiat === null ? null : <div className="text-2xl font-semibold">{fundFiat}</div>}
          </dd>
        </div>
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payments per day by purpose</h2>
        {PurposeChart(orderedDays, numberFormat, rateDay, fiat)}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Forum payments before and after the release</h2>
        {ForumChart(usage, numberFormat, rateDay, fiat)}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Shop till: charges created and paid</h2>
        {ShopChart(usage, numberFormat)}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payment sizes</h2>
        {SizeChart(usage, numberFormat, rateDay, fiat)}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Time of day (Manila, UTC+8)</h2>
        {HourChart(usage, numberFormat)}
      </section>
      <WalletsPerDay usage={usage} wallets={wallets} numberFormat={numberFormat} />

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Where the money comes from and where it goes</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full min-w-0 text-ink scheme-light [--color-app-border:#e5e5e5] [--color-app-border-strong:#d4d4d4] [--color-app-btn:#171717] [--color-app-btn-fg:#ffffff] [--color-app-btn-hover:#404040] [--color-app-card:#ffffff] [--color-app-card-muted:#fafafa] [--color-app-danger:#b91c1c] [--color-app-fg:#171717] [--color-app-focus:#171717] [--color-app-hover:#fafafa] [--color-app-muted:#525252] sm:w-auto">
            <div className="rounded-2xl bg-paper px-5 py-3">
              <FilterMenu
                label="Day"
                allLabel="All days"
                value={dayKey === 'all' ? '' : dayKey}
                options={[
                  { value: '', label: 'All days', swatch: null },
                  ...orderedDays.map((day) => ({ value: day.day, label: day.day, swatch: null })),
                ]}
                onChange={(next) => {
                  setDayKey(next === '' ? 'all' : next);
                }}
              />
            </div>
          </div>
          <SegmentedControl
            value={metric}
            options={[
              { value: 'amount', label: 'Amount' },
              { value: 'count', label: 'Count' },
            ]}
            onChange={setMetric}
            ariaLabel="Flow metric"
            tone="gift"
            shell="dark"
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Tondo fund</h3>
          <WalletFlowDiagram
            account="fund"
            accountLabel="Tondo fund"
            flows={diagramFlows}
            startSats={fundChoice.startSats}
            endSats={fundChoice.endSats}
            metric={metric}
            numberFormat={numberFormat}
            spot={{ rateDay, fiat }}
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Member wallets (all together)</h3>
          <WalletFlowDiagram
            account="members"
            accountLabel="Member wallets"
            flows={diagramFlows}
            startSats={memberChoice.startSats}
            endSats={memberChoice.endSats}
            metric={metric}
            numberFormat={numberFormat}
            spot={{ rateDay, fiat }}
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">All flows</h3>
          <div data-testid="all-flows-stack" className="space-y-3 sm:hidden">
            {tableRows.map((row) => {
              const key = `${row.from}|${row.to}|${row.purpose}`;
              const fromLabel = PARTY_LABEL[row.from];
              const toLabel = PARTY_LABEL[row.to];
              const purposeLabel = PURPOSE_LABEL[row.purpose];
              const parties = `${fromLabel} → ${toLabel} · ${purposeLabel}`;
              const countText = formatCount(row.count, numberFormat);
              const satsText = bitcoinWithFiat(row.sats, rateDay, fiat, numberFormat);
              const feeText = bitcoinWithFiat(row.feeSats, rateDay, fiat, numberFormat);
              const figures = `${countText} payments · ${satsText} · fee ${feeText}`;
              return (
                <div key={key} data-flow-row={key} className="space-y-1 text-sm">
                  <p data-flow-line="parties">{parties}</p>
                  <p data-flow-line="figures" className="break-words tabular-nums">
                    {figures}
                  </p>
                </div>
              );
            })}
          </div>
          <table className="hidden w-full table-fixed text-xs sm:table">
            <thead>
              <tr>
                <th scope="col" className="px-1 py-1 text-left font-medium">
                  From
                </th>
                <th scope="col" className="px-1 py-1 text-left font-medium">
                  To
                </th>
                <th scope="col" className="px-1 py-1 text-left font-medium">
                  Purpose
                </th>
                <th scope="col" className="px-1 py-1 text-left font-medium">
                  Payments
                </th>
                <th scope="col" className="px-1 py-1 text-left font-medium">
                  Sats
                </th>
                <th scope="col" className="px-1 py-1 text-left font-medium">
                  Fee
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const key = `${row.from}|${row.to}|${row.purpose}`;
                return (
                  <tr key={key} data-flow-row={key}>
                    <td className="px-1 py-1 align-top">{PARTY_LABEL[row.from]}</td>
                    <td className="px-1 py-1 align-top">{PARTY_LABEL[row.to]}</td>
                    <td className="px-1 py-1 align-top">{PURPOSE_LABEL[row.purpose]}</td>
                    <td className="break-words px-1 py-1 align-top tabular-nums">
                      {formatCount(row.count, numberFormat)}
                    </td>
                    <td className="break-words px-1 py-1 align-top tabular-nums">
                      {bitcoinWithFiat(row.sats, rateDay, fiat, numberFormat)}
                    </td>
                    <td className="break-words px-1 py-1 align-top tabular-nums">
                      {bitcoinWithFiat(row.feeSats, rateDay, fiat, numberFormat)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <details>
        <summary className="cursor-pointer text-lg font-semibold">
          How these numbers are made
        </summary>
        <p className="mt-3 text-sm text-paper/80">
          Wallet payments are counted once even when both sides are 21.gifts wallets. Balances in
          the flow diagrams are computed from payments starting at 0 on the release day. The
          headline wallet balance on /stats is the last reported balance and can lag. The Tondo fund
          is the account paying daily, moderator and welcome gifts. Days are UTC. The time-of-day
          chart is Manila time (UTC+8).
        </p>
      </details>
    </div>
  );
}
