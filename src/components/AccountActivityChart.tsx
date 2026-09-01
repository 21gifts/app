'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import {
  activityMaxY,
  activityValue,
  alignActivitySeries,
  type ActivityScale,
} from '@/lib/account-activity';
import type { GiftStats } from '@/lib/api-types';
import { formatBitcoin, formatUsdTick } from '@/lib/stats-money';

/** Props for {@link AccountActivityChart}. */
export interface AccountActivityChartProps {
  /** Cumulative receive series from filtered gift stats. */
  received: GiftStats['spendOverTime'];
  /**
   * Cumulative give series. Defaults to `[]` so Given stays zero on the same
   * days as `received` (v1: payments are not attributed).
   */
  donated?: GiftStats['spendOverTime'];
}

const GIVEN_STROKE = 'var(--color-app-chart-given)';
const RECEIVED_STROKE = 'var(--color-app-chart-received)';
const WIDTH = 400;
const HEIGHT = 110;
const PAD_L = 56;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 20;

/**
 * Compact dual-line cumulative chart of Given and Received with ₿|USD toggle.
 *
 * @param props - Receive series and optional donate series.
 * @returns Legend + scale chrome and reserved-height SVG (no title heading).
 */
export function AccountActivityChart({
  received,
  donated = [],
}: AccountActivityChartProps): ReactElement {
  const { t, locale } = useTranslations();
  const [scale, setScale] = useState<ActivityScale>('sat');
  const points = alignActivitySeries(received, donated);
  const maxY = activityMaxY(points, scale);
  const dataMax = points.reduce(
    (acc, point) =>
      Math.max(
        acc,
        activityValue(point, 'donated', scale),
        activityValue(point, 'received', scale),
      ),
    0,
  );
  const formatTick =
    scale === 'sat' ? (value: number): string => formatBitcoin(value, locale) : formatUsdTick;
  const ariaLabel = scale === 'sat' ? t('profile.chartSat') : t('profile.chartUsd');

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const n = points.length;
  const xAt = (i: number): number => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number): number => PAD_T + innerH - (v / maxY) * innerH;

  const linePoints = (series: 'donated' | 'received'): string => {
    if (n === 0) {
      return '';
    }
    if (n === 1) {
      const y = yAt(activityValue(points[0] as (typeof points)[number], series, scale)).toFixed(1);
      return `${PAD_L},${y} ${(PAD_L + innerW).toFixed(1)},${y}`;
    }
    return points
      .map(
        (point, i) => `${xAt(i).toFixed(1)},${yAt(activityValue(point, series, scale)).toFixed(1)}`,
      )
      .join(' ');
  };

  const yTicks: number[] = [];
  const yTickLabels = new Set<string>();
  for (const fraction of dataMax === 0 ? [0] : [0, 1, 0.5]) {
    const tick = maxY * fraction;
    const label = formatTick(tick);
    if (yTickLabels.has(label)) {
      continue;
    }
    yTickLabels.add(label);
    yTicks.push(tick);
  }
  const xIdx =
    n === 0 ? [] : [...new Set(n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1])];

  const donatedLine = linePoints('donated');
  const receivedLine = linePoints('received');
  const emptySats =
    n === 0 ||
    points.every(
      (point) => point.cumulativeDonatedSats === 0 && point.cumulativeReceivedSats === 0,
    );

  if (emptySats) {
    return (
      <p className="text-center text-sm text-app-muted" role="status">
        {t('profile.chartEmpty')}
      </p>
    );
  }

  return (
    <div role="group" aria-label={t('profile.chartTitle')} className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs text-app-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm bg-app-chart-given"
            />
            {t('profile.legendGiven')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm bg-app-chart-received"
            />
            {t('profile.legendReceived')}
          </span>
        </div>
        <div
          role="group"
          aria-label={t('profile.chartScale')}
          className="flex overflow-hidden rounded-md border border-app-border text-xs"
        >
          <button
            type="button"
            aria-pressed={scale === 'sat'}
            className={`px-2 py-1 ${
              scale === 'sat' ? 'bg-app-accent text-app-accent-fg' : 'text-app-muted'
            }`}
            onClick={() => setScale('sat')}
          >
            {t('profile.scaleSat')}
          </button>
          <button
            type="button"
            aria-pressed={scale === 'usd'}
            className={`px-2 py-1 ${
              scale === 'usd' ? 'bg-app-accent text-app-accent-fg' : 'text-app-muted'
            }`}
            onClick={() => setScale('usd')}
          >
            {t('profile.scaleUsd')}
          </button>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {yTicks.map((tick) => (
          <g key={`y-${formatTick(tick)}`}>
            <line
              x1={PAD_L}
              x2={PAD_L + innerW}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="var(--color-app-border)"
            />
            <text
              x={PAD_L - 6}
              y={yAt(tick) + 3}
              textAnchor="end"
              fill="var(--color-app-muted)"
              fontSize="9"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {donatedLine !== '' ? (
          <polyline points={donatedLine} fill="none" stroke={GIVEN_STROKE} strokeWidth="1.5" />
        ) : null}
        {receivedLine !== '' ? (
          <polyline points={receivedLine} fill="none" stroke={RECEIVED_STROKE} strokeWidth="1.5" />
        ) : null}
        {points.map((point, i) => {
          const prevDonated =
            i === 0 ? 0 : activityValue(points[i - 1] as (typeof points)[number], 'donated', scale);
          const prevReceived =
            i === 0
              ? 0
              : activityValue(points[i - 1] as (typeof points)[number], 'received', scale);
          const donatedVal = activityValue(point, 'donated', scale);
          const receivedVal = activityValue(point, 'received', scale);
          const cx = xAt(i);
          return (
            <g key={`dots-${point.day}`}>
              {donatedVal - prevDonated > 0 ? (
                <circle cx={cx} cy={yAt(donatedVal)} r={2} fill={GIVEN_STROKE} />
              ) : null}
              {receivedVal - prevReceived > 0 ? (
                <circle cx={cx} cy={yAt(receivedVal)} r={2} fill={RECEIVED_STROKE} />
              ) : null}
            </g>
          );
        })}
        {xIdx.map((i, tickIndex) => {
          const point = points[i] as (typeof points)[number];
          const anchor =
            xIdx.length > 1 && tickIndex === 0
              ? 'start'
              : xIdx.length > 1 && tickIndex === xIdx.length - 1
                ? 'end'
                : 'middle';
          return (
            <text
              key={`x-${point.day}`}
              x={xAt(i)}
              y={HEIGHT - 4}
              textAnchor={anchor}
              fill="var(--color-app-muted)"
              fontSize="9"
            >
              {point.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
