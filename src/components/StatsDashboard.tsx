'use client';

import { useState, type ReactElement } from 'react';
import { FiatPicker } from '@/components/FiatPicker';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, SegmentedControl } from '@/components/ui';
import type { GiftStats } from '@/lib/api-types';
import {
  defaultFiatForLocale,
  formatBitcoin,
  formatFiatDisplay,
  formatFiatTick,
  formatUsdDisplay,
  type FiatCode,
} from '@/lib/stats-money';

/** Props for {@link StatsDashboard}. */
export interface StatsDashboardProps {
  /** Aggregated stats, or `null` before the first successful load. */
  stats: GiftStats | null;
  /** Visitor-facing error, or `null`. */
  error: string | null;
  /** True while a fetch is in flight. */
  loading: boolean;
  /** Retry handler for a failed fetch. */
  onRetry: () => void;
}

type BarScale = 'btc' | 'fiat';

/** Row fields that carry USD plus nullable CHF/EUR/PHP. */
type FiatAmounts = {
  usd: string;
  chf: string | null;
  eur: string | null;
  php: string | null;
};

/**
 * Picks the selected fiat total from a stats payload.
 *
 * @param stats - Loaded gift stats.
 * @param fiat - Selected code.
 * @returns Two-decimal string, or `null` when unsummed.
 */
function totalFor(stats: GiftStats, fiat: FiatCode): string | null {
  switch (fiat) {
    case 'USD':
      return stats.totalUsd;
    case 'CHF':
      return stats.totalChf;
    case 'EUR':
      return stats.totalEur;
    case 'PHP':
      return stats.totalPhp;
  }
}

/**
 * Picks the selected fiat amount from a series or bar row.
 *
 * @param row - USD plus nullable CHF/EUR/PHP.
 * @param fiat - Selected code.
 * @returns Two-decimal string, or `null` when unsummed.
 */
function amountOf(row: FiatAmounts, fiat: FiatCode): string | null {
  switch (fiat) {
    case 'USD':
      return row.usd;
    case 'CHF':
      return row.chf;
    case 'EUR':
      return row.eur;
    case 'PHP':
      return row.php;
  }
}

/**
 * Picks the selected cumulative fiat from an over-time point.
 *
 * @param point - Daily cumulative point.
 * @param fiat - Selected code.
 * @returns Two-decimal string, or `null` when unsummed.
 */
function cumulativeOf(point: GiftStats['spendOverTime'][number], fiat: FiatCode): string | null {
  switch (fiat) {
    case 'USD':
      return point.cumulativeUsd;
    case 'CHF':
      return point.cumulativeChf;
    case 'EUR':
      return point.cumulativeEur;
    case 'PHP':
      return point.cumulativePhp;
  }
}

/**
 * Converts an API fiat amount string to integer cents for bar sizing.
 *
 * @param amount - Fiat amount as a decimal string, or `null`.
 * @returns Rounded cents, or 0 when `amount` is `null`.
 */
function fiatCents(amount: string | null): number {
  if (amount === null) {
    return 0;
  }
  return Math.round(Number(amount) * 100);
}

/**
 * Numeric bar-scale value for the active unit.
 *
 * @param scale - Whether bars are sized by ₿ (sats) or fiat (cents).
 * @param sats - Whole satoshis.
 * @param amount - Selected fiat amount string, or `null`.
 * @returns Sats when `scale` is `btc`, else cents.
 */
function scaleValue(scale: BarScale, sats: number, amount: string | null): number {
  return scale === 'btc' ? sats : fiatCents(amount);
}

/**
 * Formats a gift/recipient count with grouping separators (not a bitcoin amount).
 *
 * @param n - Whole count.
 * @returns Grouped decimal string.
 */
function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * UTC calendar day from an ISO timestamp, or an em dash when missing.
 *
 * @param iso - ISO-8601 timestamp or `null`.
 * @returns `YYYY-MM-DD` or `—`.
 */
function utcDay(iso: string | null): string {
  if (iso === null) {
    return '—';
  }
  return iso.slice(0, 10);
}

/**
 * Footnote for the selected fiat (stats English, not catalogized).
 *
 * @param fiat - Selected code.
 * @returns One sentence.
 */
function fiatFootnote(fiat: FiatCode): string {
  if (fiat === 'USD') {
    return "USD is the BTC-USD daily close (UTC) on each gift's day.";
  }
  return `${fiat} is USD at each gift's UTC-day close, converted with that day's ECB rate.`;
}

/**
 * Cumulative spend-over-time area chart for one money series.
 *
 * Days with spend are SVG links to `/stats/{day}` on the series (not a text list).
 *
 * @param series - Daily cumulative points.
 * @param valueAt - Extract the numeric cumulative value used for scale only.
 * @param formatTick - Axis tick label formatter.
 * @param ariaLabel - Accessible chart title.
 * @returns SVG figure.
 */
function CumulativeOverTimeChart(
  series: GiftStats['spendOverTime'],
  valueAt: (point: GiftStats['spendOverTime'][number]) => number,
  formatTick: (value: number) => string,
  ariaLabel: string,
): ReactElement {
  const width = 800;
  const height = 280;
  if (series.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      />
    );
  }
  const padL = 96;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const values = series.map(valueAt);
  const dataMax = Math.max(...values, 0);
  const maxY = dataMax === 0 ? 1 : dataMax;
  const n = series.length;
  const xAt = (i: number): number => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number): number => padT + innerH - (v / maxY) * innerH;
  const bottom = (padT + innerH).toFixed(1);
  const firstY = yAt(values[0] as number).toFixed(1);
  const line =
    n === 1
      ? `${padL},${firstY} ${(padL + innerW).toFixed(1)},${firstY}`
      : series
          .map((_, i) => `${xAt(i).toFixed(1)},${yAt(values[i] as number).toFixed(1)}`)
          .join(' ');
  const area =
    n === 1
      ? `${padL},${bottom} ${padL},${firstY} ${(padL + innerW).toFixed(1)},${firstY} ${(padL + innerW).toFixed(1)},${bottom}`
      : `${padL},${bottom} ${line} ${(padL + innerW).toFixed(1)},${bottom}`;
  const yTicks: number[] = [];
  const yTickLabels = new Set<string>();
  for (const t of dataMax === 0 ? [0] : [0, 1, 0.5]) {
    const tick = maxY * t;
    const label = formatTick(tick);
    if (yTickLabels.has(label)) {
      continue;
    }
    yTickLabels.add(label);
    yTicks.push(tick);
  }
  const xIdx = [...new Set(n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1])];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="group"
      aria-label={ariaLabel}
    >
      {yTicks.map((tick) => (
        <g key={formatTick(tick)}>
          <line
            x1={padL}
            x2={padL + innerW}
            y1={yAt(tick)}
            y2={yAt(tick)}
            className="stroke-paper/8"
          />
          <text
            x={padL - 8}
            y={yAt(tick) + 4}
            textAnchor="end"
            className="fill-paper/50"
            fontSize="12"
          >
            {formatTick(tick)}
          </text>
        </g>
      ))}
      <polygon points={area} className="fill-accent/25" />
      <polyline points={line} fill="none" className="stroke-accent" strokeWidth="2" />
      {series.map((point, i) => {
        if (point.sats <= 0) {
          return null;
        }
        const cx = xAt(i);
        const cy = yAt(values[i] as number);
        const hitX = i === 0 ? padL : (xAt(i - 1) + cx) / 2;
        const hitEnd = i === n - 1 ? padL + innerW : (cx + xAt(i + 1)) / 2;
        return (
          <a
            key={`${ariaLabel}-day-${point.day}`}
            href={`/stats/${point.day}`}
            aria-label={point.day}
            className="cursor-pointer"
          >
            <rect x={hitX} y={padT} width={hitEnd - hitX} height={innerH} fill="transparent" />
            <circle cx={cx} cy={cy} r={3.5} className="fill-accent" pointerEvents="none" />
          </a>
        );
      })}
      {xIdx.map((i, tickIndex) => {
        const point = series[i] as (typeof series)[number];
        const anchor =
          xIdx.length > 1 && tickIndex === 0
            ? 'start'
            : xIdx.length > 1 && tickIndex === xIdx.length - 1
              ? 'end'
              : 'middle';
        return (
          <text
            key={`${ariaLabel}-${point.day}`}
            x={xAt(i)}
            y={height - 10}
            textAnchor={anchor}
            className="fill-paper/50"
            fontSize="12"
          >
            {point.day}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Horizontal bar chart of spend by recipient.
 *
 * Bars are sized by the active scale (sats or fiat cents). Labels show ₿ and the selected fiat.
 *
 * @param rows - Recipient totals.
 * @param scale - Whether bar widths use sats or fiat cents.
 * @param fiat - Selected fiat for labels and fiat-scale sizing.
 * @returns Bar list.
 */
function ByPersonChart(
  rows: GiftStats['byRecipient'],
  scale: BarScale,
  fiat: FiatCode,
): ReactElement {
  const width = 800;
  const rowH = 40;
  const padL = 8;
  const padR = 8;
  const labelW = 160;
  const valueW = 220;
  const barMax = width - padL - padR - labelW - valueW;
  const height = Math.max(rows.length, 1) * rowH;
  const max = Math.max(...rows.map((r) => scaleValue(scale, r.sats, amountOf(r, fiat))), 1);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={scale === 'btc' ? 'Spend by person in ₿' : `Spend by person in ${fiat}`}
    >
      {rows.map((row, i) => {
        const y = i * rowH;
        const value = scaleValue(scale, row.sats, amountOf(row, fiat));
        const barW = value === 0 ? 0 : Math.max(2, (value / max) * barMax);
        return (
          <g key={row.recipient}>
            <text x={padL} y={y + 22} className="fill-paper/90" fontSize="14">
              {row.recipient}
            </text>
            {barW > 0 ? (
              <rect
                x={padL + labelW}
                y={y + 12}
                width={barW}
                height={12}
                rx={6}
                className="fill-accent"
              />
            ) : null}
            <text
              x={width - padR}
              y={y + 22}
              textAnchor="end"
              className="fill-paper/60"
              fontSize="14"
            >
              {formatBitcoin(row.sats)} · {formatFiatDisplay(amountOf(row, fiat), fiat)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Vertical bar chart of spend by month.
 *
 * Bars are sized by the active scale (sats or fiat cents). Labels above each bar show ₿ and the selected fiat.
 *
 * @param rows - Monthly totals.
 * @param scale - Whether bar heights use sats or fiat cents.
 * @param fiat - Selected fiat for labels and fiat-scale sizing.
 * @returns SVG figure.
 */
function ByMonthChart(rows: GiftStats['byMonth'], scale: BarScale, fiat: FiatCode): ReactElement {
  const width = 800;
  const height = 220;
  const monthAria = scale === 'btc' ? 'Spend by month in ₿' : `Spend by month in ${fiat}`;
  if (rows.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={monthAria}
      />
    );
  }
  const padL = 56;
  const padR = 16;
  const padT = 44;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxY = Math.max(...rows.map((r) => scaleValue(scale, r.sats, amountOf(r, fiat))), 1);
  const barW = innerW / Math.max(rows.length, 1);
  const yAt = (v: number): number => padT + innerH - (v / maxY) * innerH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={monthAria}
    >
      {rows.map((row, i) => {
        const x = padL + i * barW + barW * 0.15;
        const w = barW * 0.7;
        const axisY = padT + innerH;
        const value = scaleValue(scale, row.sats, amountOf(row, fiat));
        const barTop = yAt(value);
        const h = axisY - barTop;
        const displayH = value > 0 ? Math.max(h, 1) : 0;
        const usdY = Math.min(barTop - 6, axisY - 22);
        const btcY = usdY - 14;
        return (
          <g key={row.month}>
            {displayH > 0 ? (
              <rect
                x={x}
                y={axisY - displayH}
                width={w}
                height={displayH}
                className="fill-accent"
              />
            ) : null}
            <text
              x={x + w / 2}
              y={btcY}
              textAnchor="middle"
              className="fill-paper/70"
              fontSize="11"
            >
              {formatBitcoin(row.sats)}
            </text>
            <text
              x={x + w / 2}
              y={usdY}
              textAnchor="middle"
              className="fill-paper/70"
              fontSize="11"
            >
              {formatFiatDisplay(amountOf(row, fiat), fiat)}
            </text>
            <text
              x={x + w / 2}
              y={height - 10}
              textAnchor="middle"
              className="fill-paper/50"
              fontSize="12"
            >
              {row.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Non-empty charts branch with independent ₿/fiat scale state per diagram.
 *
 * Over time shows one cumulative series; days with spend link to `/stats/{day}`
 * on the chart. Person and month bars rescale; their labels stay both units.
 *
 * @param stats - Loaded gift stats with at least one gift.
 * @param fiat - Selected fiat for the second scale cell, footnote, and labels.
 * @returns Diagram sections.
 */
function StatsCharts({ stats, fiat }: { stats: GiftStats; fiat: FiatCode }): ReactElement {
  const [overTimeScale, setOverTimeScale] = useState<BarScale>('btc');
  const [personScale, setPersonScale] = useState<BarScale>('btc');
  const [monthScale, setMonthScale] = useState<BarScale>('btc');
  const scaleOptions = [
    { value: 'btc' as const, label: '₿' },
    { value: 'fiat' as const, label: fiat },
  ];

  return (
    <>
      <p className="text-sm text-paper/60">{fiatFootnote(fiat)}</p>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium tracking-widest text-accent uppercase">
            Total spend over time
          </h2>
          <SegmentedControl
            value={overTimeScale}
            options={scaleOptions}
            onChange={setOverTimeScale}
            ariaLabel="Over time scale"
            tone="gift"
            shell="dark"
          />
        </div>
        <div className="mt-6">
          {overTimeScale === 'btc'
            ? CumulativeOverTimeChart(
                stats.spendOverTime,
                (p) => p.cumulativeSats,
                formatBitcoin,
                'Spend over time in ₿',
              )
            : CumulativeOverTimeChart(
                stats.spendOverTime,
                (p) => {
                  const raw = cumulativeOf(p, fiat);
                  return raw === null ? 0 : Number(raw);
                },
                (value) => {
                  const allNull = stats.spendOverTime.every((p) => cumulativeOf(p, fiat) === null);
                  return allNull ? '\u2014' : formatFiatTick(value, fiat);
                },
                `Spend over time in ${fiat}`,
              )}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium tracking-widest text-accent uppercase">By person</h2>
          <SegmentedControl
            value={personScale}
            options={scaleOptions}
            onChange={setPersonScale}
            ariaLabel="By person bar scale"
            tone="gift"
            shell="dark"
          />
        </div>
        <div className="mt-6">{ByPersonChart(stats.byRecipient, personScale, fiat)}</div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium tracking-widest text-accent uppercase">By month</h2>
          <SegmentedControl
            value={monthScale}
            options={scaleOptions}
            onChange={setMonthScale}
            ariaLabel="By month bar scale"
            tone="gift"
            shell="dark"
          />
        </div>
        <div className="mt-6">{ByMonthChart(stats.byMonth, monthScale, fiat)}</div>
      </section>
    </>
  );
}

/**
 * Gift statistics dashboard: KPI cards and diagrams (₿ plus one selected fiat).
 *
 * @param props - Stats payload plus loading/error/retry.
 * @returns The dashboard element.
 */
export function StatsDashboard({
  stats,
  error,
  loading,
  onRetry,
}: StatsDashboardProps): ReactElement {
  const { locale } = useTranslations();
  const [fiat, setFiat] = useState<FiatCode>(() => defaultFiatForLocale(locale));

  if (loading && stats === null && error === null) {
    return <p className="text-paper/60">Loading…</p>;
  }

  if (error !== null && stats === null) {
    return (
      <div className="space-y-4">
        <p className="text-paper/80">{error}</p>
        <Button type="button" variant="accent" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (stats === null) {
    return <p className="text-paper/60">Loading…</p>;
  }

  const empty = stats.giftCount === 0;
  const spentFiat = totalFor(stats, fiat);

  return (
    <div className="space-y-12">
      <FiatPicker value={fiat} onChange={setFiat} />
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Total spent</dt>
          <dd className="mt-2 tabular-nums lining-nums">
            <div className="text-2xl font-semibold">{formatBitcoin(stats.totalSats)}</div>
            <div className="text-2xl font-semibold">
              {fiat === 'USD' && spentFiat !== null
                ? formatUsdDisplay(spentFiat)
                : formatFiatDisplay(spentFiat, fiat)}
            </div>
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Gifts</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {formatCount(stats.giftCount)}
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">People</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {formatCount(stats.recipientCount)}
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Period</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {utcDay(stats.firstPaidAt)} – {utcDay(stats.lastPaidAt)}
          </dd>
        </div>
      </dl>

      {empty ? (
        <p className="text-paper/60">No gifts recorded yet.</p>
      ) : (
        <StatsCharts stats={stats} fiat={fiat} />
      )}
    </div>
  );
}
