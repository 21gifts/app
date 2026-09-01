'use client';

import { useState, type ReactElement } from 'react';
import { Button } from '@/components/ui';
import type { GiftStats } from '@/lib/api-types';
import { formatBitcoin, formatUsdDisplay, formatUsdTick } from '@/lib/stats-money';

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

const ORANGE = '#f7931a';

type BarScale = 'btc' | 'usd';

/**
 * Converts an API USD amount string to integer cents for bar sizing.
 *
 * @param usd - USD amount as a decimal string (e.g. `"50.00"`).
 * @returns Rounded cents.
 */
function usdCents(usd: string): number {
  return Math.round(Number(usd) * 100);
}

/**
 * Numeric bar-scale value for the active unit.
 *
 * @param scale - Whether bars are sized by ₿ (sats) or USD (cents).
 * @param sats - Whole satoshis.
 * @param usd - USD amount string from the stats payload.
 * @returns Sats when `scale` is `btc`, else cents.
 */
function scaleValue(scale: BarScale, sats: number, usd: string): number {
  return scale === 'btc' ? sats : usdCents(usd);
}

/**
 * Compact ₿ | USD segmented control for diagram scale.
 *
 * @param value - Active scale.
 * @param onChange - Called with the next scale.
 * @param groupLabel - Accessible name for the button group.
 * @returns Toggle element.
 */
function BarScaleToggle({
  value,
  onChange,
  groupLabel,
}: {
  value: BarScale;
  onChange: (next: BarScale) => void;
  groupLabel: string;
}): ReactElement {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex overflow-hidden rounded-md border border-paper/20 text-xs"
    >
      <button
        type="button"
        aria-pressed={value === 'btc'}
        className={`px-2 py-1 ${value === 'btc' ? 'bg-accent text-ink' : 'text-paper/70'}`}
        onClick={() => onChange('btc')}
      >
        ₿
      </button>
      <button
        type="button"
        aria-pressed={value === 'usd'}
        className={`px-2 py-1 ${value === 'usd' ? 'bg-accent text-ink' : 'text-paper/70'}`}
        onClick={() => onChange('usd')}
      >
        USD
      </button>
    </div>
  );
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
            stroke="rgba(255,255,255,0.08)"
          />
          <text
            x={padL - 8}
            y={yAt(tick) + 4}
            textAnchor="end"
            fill="rgba(255,255,255,0.5)"
            fontSize="12"
          >
            {formatTick(tick)}
          </text>
        </g>
      ))}
      <polygon points={area} fill={ORANGE} fillOpacity="0.25" />
      <polyline points={line} fill="none" stroke={ORANGE} strokeWidth="2" />
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
            <circle cx={cx} cy={cy} r={3.5} fill={ORANGE} pointerEvents="none" />
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
            fill="rgba(255,255,255,0.5)"
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
 * Bars are sized by the active scale (sats or USD cents). Labels show ₿ and USD.
 *
 * @param rows - Recipient totals.
 * @param scale - Whether bar widths use sats or USD cents.
 * @returns Bar list.
 */
function ByPersonChart(rows: GiftStats['byRecipient'], scale: BarScale): ReactElement {
  const width = 800;
  const rowH = 40;
  const padL = 8;
  const padR = 8;
  const labelW = 160;
  const valueW = 220;
  const barMax = width - padL - padR - labelW - valueW;
  const height = Math.max(rows.length, 1) * rowH;
  const max = Math.max(...rows.map((r) => scaleValue(scale, r.sats, r.usd)), 1);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={scale === 'btc' ? 'Spend by person in ₿' : 'Spend by person in USD'}
    >
      {rows.map((row, i) => {
        const y = i * rowH;
        const value = scaleValue(scale, row.sats, row.usd);
        const barW = value === 0 ? 0 : Math.max(2, (value / max) * barMax);
        return (
          <g key={row.recipient}>
            <text x={padL} y={y + 22} fill="rgba(255,255,255,0.9)" fontSize="14">
              {row.recipient}
            </text>
            {barW > 0 ? (
              <rect x={padL + labelW} y={y + 12} width={barW} height={12} rx={6} fill={ORANGE} />
            ) : null}
            <text
              x={width - padR}
              y={y + 22}
              textAnchor="end"
              fill="rgba(255,255,255,0.6)"
              fontSize="14"
            >
              {formatBitcoin(row.sats)} · ${row.usd}
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
 * Bars are sized by the active scale (sats or USD cents). Labels above each bar show ₿ and USD.
 *
 * @param rows - Monthly totals.
 * @param scale - Whether bar heights use sats or USD cents.
 * @returns SVG figure.
 */
function ByMonthChart(rows: GiftStats['byMonth'], scale: BarScale): ReactElement {
  const width = 800;
  const height = 220;
  const monthAria = scale === 'btc' ? 'Spend by month in ₿' : 'Spend by month in USD';
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
  const maxY = Math.max(...rows.map((r) => scaleValue(scale, r.sats, r.usd)), 1);
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
        const value = scaleValue(scale, row.sats, row.usd);
        const barTop = yAt(value);
        const h = axisY - barTop;
        const displayH = value > 0 ? Math.max(h, 1) : 0;
        const usdY = Math.min(barTop - 6, axisY - 22);
        const btcY = usdY - 14;
        return (
          <g key={row.month}>
            {displayH > 0 ? (
              <rect x={x} y={axisY - displayH} width={w} height={displayH} fill={ORANGE} />
            ) : null}
            <text
              x={x + w / 2}
              y={btcY}
              textAnchor="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize="11"
            >
              {formatBitcoin(row.sats)}
            </text>
            <text
              x={x + w / 2}
              y={usdY}
              textAnchor="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize="11"
            >
              {formatUsdDisplay(row.usd)}
            </text>
            <text
              x={x + w / 2}
              y={height - 10}
              textAnchor="middle"
              fill="rgba(255,255,255,0.5)"
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
 * Non-empty charts branch with independent ₿/USD scale state per diagram.
 *
 * Over time shows one cumulative series; days with spend link to `/stats/{day}`
 * on the chart. Person and month bars rescale; their labels stay both units.
 *
 * @param stats - Loaded gift stats with at least one gift.
 * @returns Diagram sections.
 */
function StatsCharts({ stats }: { stats: GiftStats }): ReactElement {
  const [overTimeScale, setOverTimeScale] = useState<BarScale>('btc');
  const [personScale, setPersonScale] = useState<BarScale>('btc');
  const [monthScale, setMonthScale] = useState<BarScale>('btc');

  return (
    <>
      <p className="text-sm text-paper/60">
        {"USD is the BTC-USD daily close (UTC) on each gift's day."}
      </p>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm tracking-widest text-accent uppercase">Total spend over time</h2>
          <BarScaleToggle
            value={overTimeScale}
            onChange={setOverTimeScale}
            groupLabel="Over time scale"
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
                (p) => Number(p.cumulativeUsd),
                formatUsdTick,
                'Spend over time in USD',
              )}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm tracking-widest text-accent uppercase">By person</h2>
          <BarScaleToggle
            value={personScale}
            onChange={setPersonScale}
            groupLabel="By person bar scale"
          />
        </div>
        <div className="mt-6">{ByPersonChart(stats.byRecipient, personScale)}</div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm tracking-widest text-accent uppercase">By month</h2>
          <BarScaleToggle
            value={monthScale}
            onChange={setMonthScale}
            groupLabel="By month bar scale"
          />
        </div>
        <div className="mt-6">{ByMonthChart(stats.byMonth, monthScale)}</div>
      </section>
    </>
  );
}

/**
 * Gift statistics dashboard: KPI cards and diagrams (₿ + USD).
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

  return (
    <div className="space-y-12">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Total spent</dt>
          <dd className="mt-2">
            <div className="text-2xl font-semibold">{formatBitcoin(stats.totalSats)}</div>
            <div className="text-2xl font-semibold">{formatUsdDisplay(stats.totalUsd)}</div>
          </dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Gifts</dt>
          <dd className="mt-2 text-2xl font-semibold">{formatCount(stats.giftCount)}</dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">People</dt>
          <dd className="mt-2 text-2xl font-semibold">{formatCount(stats.recipientCount)}</dd>
        </div>
        <div className="rounded-2xl border border-paper/10 p-5">
          <dt className="text-sm text-paper/60">Period</dt>
          <dd className="mt-2 text-2xl font-semibold">
            {utcDay(stats.firstPaidAt)} – {utcDay(stats.lastPaidAt)}
          </dd>
        </div>
      </dl>

      {empty ? (
        <p className="text-paper/60">No gifts recorded yet.</p>
      ) : (
        <StatsCharts stats={stats} />
      )}
    </div>
  );
}
