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
import { formatSatTick, formatUsdTick } from '@/lib/stats-money';

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

const GIVEN_STROKE = '#525252';
const RECEIVED_STROKE = '#f7931a';
const GRID_STROKE = '#e5e5e5';
const AXIS_FILL = '#737373';
const WIDTH = 800;
const HEIGHT = 280;
const PAD_L = 72;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 40;

/**
 * Light dual-line cumulative chart of Given and Received with Sat|USD toggle.
 *
 * @param props - Receive series and optional donate series.
 * @returns Title row, legend, and reserved-height SVG.
 */
export function AccountActivityChart({
  received,
  donated = [],
}: AccountActivityChartProps): ReactElement {
  const { t } = useTranslations();
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
  const formatTick = scale === 'sat' ? formatSatTick : formatUsdTick;
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

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
          {t('profile.chartTitle')}
        </h2>
        <div
          role="group"
          aria-label={t('profile.chartScale')}
          className="flex overflow-hidden rounded-md border border-neutral-200 text-xs"
        >
          <button
            type="button"
            aria-pressed={scale === 'sat'}
            className={`px-2 py-1 ${
              scale === 'sat' ? 'bg-[#f7931a] text-[#0a090c]' : 'text-neutral-500'
            }`}
            onClick={() => setScale('sat')}
          >
            {t('profile.scaleSat')}
          </button>
          <button
            type="button"
            aria-pressed={scale === 'usd'}
            className={`px-2 py-1 ${
              scale === 'usd' ? 'bg-[#f7931a] text-[#0a090c]' : 'text-neutral-500'
            }`}
            onClick={() => setScale('usd')}
          >
            {t('profile.scaleUsd')}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[#525252]" />
          {t('profile.legendGiven')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f7931a]" />
          {t('profile.legendReceived')}
        </span>
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
              stroke={GRID_STROKE}
            />
            <text x={PAD_L - 8} y={yAt(tick) + 4} textAnchor="end" fill={AXIS_FILL} fontSize="12">
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {donatedLine !== '' ? (
          <polyline points={donatedLine} fill="none" stroke={GIVEN_STROKE} strokeWidth="2" />
        ) : null}
        {receivedLine !== '' ? (
          <polyline points={receivedLine} fill="none" stroke={RECEIVED_STROKE} strokeWidth="2" />
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
                <circle cx={cx} cy={yAt(donatedVal)} r={3.5} fill={GIVEN_STROKE} />
              ) : null}
              {receivedVal - prevReceived > 0 ? (
                <circle cx={cx} cy={yAt(receivedVal)} r={3.5} fill={RECEIVED_STROKE} />
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
              y={HEIGHT - 10}
              textAnchor={anchor}
              fill={AXIS_FILL}
              fontSize="12"
            >
              {point.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
