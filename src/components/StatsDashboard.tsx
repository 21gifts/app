import type { ReactElement } from 'react';
import type { GiftStats } from '@/lib/api-types';

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

/**
 * Formats a sat count with grouping separators.
 *
 * @param sats - Whole satoshis.
 * @returns Grouped decimal string.
 */
function formatSats(sats: number): string {
  return new Intl.NumberFormat('en-US').format(sats);
}

/**
 * Compact axis label for large sat counts.
 *
 * @param sats - Whole satoshis.
 * @returns Compact label such as `1.2M` or `4k`.
 */
function compactSats(sats: number): string {
  if (sats >= 1_000_000) {
    const m = sats / 1_000_000;
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (sats >= 1_000) {
    const k = sats / 1_000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(sats);
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
 * Cumulative spend-over-time area chart.
 *
 * @param series - Daily cumulative points.
 * @returns SVG figure.
 */
function SpendOverTimeChart(series: GiftStats['spendOverTime']): ReactElement {
  const width = 800;
  const height = 280;
  if (series.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Total spend over time"
      />
    );
  }
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxY = Math.max(...series.map((p) => p.cumulativeSats), 1);
  const n = series.length;
  const xAt = (i: number): number => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number): number => padT + innerH - (v / maxY) * innerH;
  const bottom = (padT + innerH).toFixed(1);
  const firstY = yAt((series[0] as (typeof series)[number]).cumulativeSats).toFixed(1);
  const line =
    n === 1
      ? `${padL},${firstY} ${(padL + innerW).toFixed(1)},${firstY}`
      : series.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.cumulativeSats).toFixed(1)}`).join(' ');
  const area =
    n === 1
      ? `${padL},${bottom} ${padL},${firstY} ${(padL + innerW).toFixed(1)},${firstY} ${(padL + innerW).toFixed(1)},${bottom}`
      : `${padL},${bottom} ${line} ${(padL + innerW).toFixed(1)},${bottom}`;
  const yTicks = [...new Set([0, 0.5, 1].map((t) => Math.round(maxY * t)))];
  const xIdx = [...new Set(n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1])];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Total spend over time"
    >
      {yTicks.map((tick) => (
        <g key={tick}>
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
            {compactSats(tick)}
          </text>
        </g>
      ))}
      <polygon points={area} fill={ORANGE} fillOpacity="0.25" />
      <polyline points={line} fill="none" stroke={ORANGE} strokeWidth="2" />
      {xIdx.map((i) => {
        const point = series[i] as (typeof series)[number];
        return (
          <text
            key={point.day}
            x={xAt(i)}
            y={height - 10}
            textAnchor="middle"
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
 * @param rows - Recipient totals.
 * @returns Bar list.
 */
function ByPersonChart(rows: GiftStats['byRecipient']): ReactElement {
  const width = 800;
  const rowH = 40;
  const padL = 8;
  const padR = 8;
  const labelW = 160;
  const valueW = 140;
  const barMax = width - padL - padR - labelW - valueW;
  const height = Math.max(rows.length, 1) * rowH;
  const max = Math.max(...rows.map((r) => r.sats), 1);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Spend by person"
    >
      {rows.map((row, i) => {
        const y = i * rowH;
        const barW = Math.max(2, (row.sats / max) * barMax);
        return (
          <g key={row.recipient}>
            <text x={padL} y={y + 22} fill="rgba(255,255,255,0.9)" fontSize="14">
              {row.recipient}
            </text>
            <rect x={padL + labelW} y={y + 12} width={barW} height={12} rx={6} fill={ORANGE} />
            <text
              x={width - padR}
              y={y + 22}
              textAnchor="end"
              fill="rgba(255,255,255,0.6)"
              fontSize="14"
            >
              {formatSats(row.sats)} sats
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
 * @param rows - Monthly totals.
 * @returns SVG figure.
 */
function ByMonthChart(rows: GiftStats['byMonth']): ReactElement {
  const width = 800;
  const height = 220;
  if (rows.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Spend by month"
      />
    );
  }
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxY = Math.max(...rows.map((r) => r.sats), 1);
  const barW = innerW / Math.max(rows.length, 1);
  const yAt = (v: number): number => padT + innerH - (v / maxY) * innerH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Spend by month"
    >
      {rows.map((row, i) => {
        const x = padL + i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = yAt(row.sats);
        const h = padT + innerH - y;
        return (
          <g key={row.month}>
            <rect x={x} y={y} width={w} height={Math.max(h, 1)} fill={ORANGE} />
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
 * Gift statistics dashboard: KPI cards and three diagrams.
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
    return <p className="text-white/60">Loading…</p>;
  }

  if (error !== null && stats === null) {
    return (
      <div className="space-y-4">
        <p className="text-white/80">{error}</p>
        <button
          type="button"
          className="rounded-full bg-[#f7931a] px-4 py-2 font-medium text-[#0a090c]"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    );
  }

  if (stats === null) {
    return <p className="text-white/60">Loading…</p>;
  }

  const empty = stats.giftCount === 0;

  return (
    <div className="space-y-12">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 p-5">
          <dt className="text-sm text-white/60">Total spent</dt>
          <dd className="mt-2 text-2xl font-semibold">{formatSats(stats.totalSats)} sats</dd>
        </div>
        <div className="rounded-2xl border border-white/10 p-5">
          <dt className="text-sm text-white/60">Gifts</dt>
          <dd className="mt-2 text-2xl font-semibold">{formatSats(stats.giftCount)}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 p-5">
          <dt className="text-sm text-white/60">People</dt>
          <dd className="mt-2 text-2xl font-semibold">{formatSats(stats.recipientCount)}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 p-5">
          <dt className="text-sm text-white/60">Period</dt>
          <dd className="mt-2 text-2xl font-semibold">
            {utcDay(stats.firstPaidAt)} – {utcDay(stats.lastPaidAt)}
          </dd>
        </div>
      </dl>

      {empty ? (
        <p className="text-white/60">No gifts recorded yet.</p>
      ) : (
        <>
          <section>
            <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">
              Total spend over time
            </h2>
            <p className="mt-2 text-white/60">Cumulative sats given, day by day.</p>
            <div className="mt-6">{SpendOverTimeChart(stats.spendOverTime)}</div>
          </section>
          <section>
            <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">By person</h2>
            <div className="mt-6">{ByPersonChart(stats.byRecipient)}</div>
          </section>
          <section>
            <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">By month</h2>
            <div className="mt-6">{ByMonthChart(stats.byMonth)}</div>
          </section>
        </>
      )}
    </div>
  );
}
