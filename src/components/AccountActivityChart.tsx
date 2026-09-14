'use client';

import { useState, type ReactElement } from 'react';
import { FiatPicker } from '@/components/FiatPicker';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { SegmentedControl } from '@/components/ui';
import {
  activityMaxY,
  activityValue,
  alignActivitySeries,
  type ActivityScale,
} from '@/lib/account-activity';
import type { GiftStats } from '@/lib/api-types';
import {
  defaultFiatForLocale,
  formatBitcoin,
  formatFiatTick,
  formatUsdTick,
  type FiatCode,
} from '@/lib/stats-money';

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

const NON_USD_CUMULATIVE: Record<
  Exclude<FiatCode, 'USD'>,
  'cumulativeChf' | 'cumulativeEur' | 'cumulativePhp'
> = {
  CHF: 'cumulativeChf',
  EUR: 'cumulativeEur',
  PHP: 'cumulativePhp',
};

/**
 * True when every source cumulative for `fiat` on both input series is `null`.
 * USD is never unsummable (the API string is always present).
 *
 * @param received - Receive `spendOverTime`.
 * @param donated - Donate `spendOverTime`.
 * @param fiat - Selected fiat.
 * @returns Whether y-ticks should be an em dash instead of `formatFiatTick`.
 */
function selectedFiatUnsummable(
  received: GiftStats['spendOverTime'],
  donated: GiftStats['spendOverTime'],
  fiat: FiatCode,
): boolean {
  if (fiat === 'USD') {
    return false;
  }
  const key = NON_USD_CUMULATIVE[fiat];
  return [...received, ...donated].every((point) => point[key] === null);
}

/**
 * Compact dual-line cumulative chart of Given and Received with FiatPicker
 * (always) and a ₿ | selected-fiat scale when the series has sats.
 *
 * @param props - Receive series and optional donate series.
 * @returns FiatPicker plus empty `profile.chartEmpty` status, or FiatPicker
 *   plus legend, selected-fiat chrome, and reserved-height SVG (no title heading).
 */
export function AccountActivityChart({
  received,
  donated = [],
}: AccountActivityChartProps): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const [fiat, setFiat] = useState<FiatCode>(() => defaultFiatForLocale(locale));
  const [scale, setScale] = useState<ActivityScale>('sat');
  const points = alignActivitySeries(received, donated);
  const emptySats =
    points.length === 0 ||
    points.every(
      (point) => point.cumulativeDonatedSats === 0 && point.cumulativeReceivedSats === 0,
    );

  const picker = (
    <FiatPicker value={fiat} onChange={setFiat} shell="app" ariaLabel={t('profile.fiatCurrency')} />
  );

  if (emptySats) {
    return (
      <div className="flex w-full flex-col gap-2">
        {picker}
        <p className="text-center text-sm text-app-muted" role="status">
          {t('profile.chartEmpty')}
        </p>
      </div>
    );
  }

  const maxY = activityMaxY(points, scale, fiat);
  const dataMax = points.reduce(
    (acc, point) =>
      Math.max(
        acc,
        activityValue(point, 'donated', scale, fiat),
        activityValue(point, 'received', scale, fiat),
      ),
    0,
  );
  const unsummableFiat = scale === 'fiat' && selectedFiatUnsummable(received, donated, fiat);
  const formatTick = (value: number): string => {
    if (scale === 'sat') {
      return formatBitcoin(value, numberFormat);
    }
    if (unsummableFiat) {
      return '\u2014';
    }
    return fiat === 'USD'
      ? formatUsdTick(value, numberFormat)
      : formatFiatTick(value, fiat, numberFormat);
  };
  const ariaLabel =
    scale === 'sat' ? t('profile.chartSat') : t('profile.chartFiat', { code: fiat });

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const n = points.length;
  const xAt = (i: number): number => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number): number => PAD_T + innerH - (v / maxY) * innerH;

  const linePoints = (series: 'donated' | 'received'): string => {
    if (n === 1) {
      const y = yAt(
        activityValue(points[0] as (typeof points)[number], series, scale, fiat),
      ).toFixed(1);
      return `${PAD_L},${y} ${(PAD_L + innerW).toFixed(1)},${y}`;
    }
    return points
      .map(
        (point, i) =>
          `${xAt(i).toFixed(1)},${yAt(activityValue(point, series, scale, fiat)).toFixed(1)}`,
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
  const xIdx = [...new Set(n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1])];

  const donatedLine = linePoints('donated');
  const receivedLine = linePoints('received');

  return (
    <div className="flex w-full flex-col gap-2">
      {picker}
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
          <SegmentedControl
            value={scale}
            options={[
              { value: 'sat' as const, label: t('profile.scaleSat') },
              { value: 'fiat' as const, label: fiat },
            ]}
            onChange={setScale}
            ariaLabel={t('profile.chartScale')}
            tone="gift"
          />
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
          <polyline points={donatedLine} fill="none" stroke={GIVEN_STROKE} strokeWidth="1.5" />
          <polyline points={receivedLine} fill="none" stroke={RECEIVED_STROKE} strokeWidth="1.5" />
          {points.map((point, i) => {
            const prevDonated =
              i === 0
                ? 0
                : activityValue(points[i - 1] as (typeof points)[number], 'donated', scale, fiat);
            const prevReceived =
              i === 0
                ? 0
                : activityValue(points[i - 1] as (typeof points)[number], 'received', scale, fiat);
            const donatedVal = activityValue(point, 'donated', scale, fiat);
            const receivedVal = activityValue(point, 'received', scale, fiat);
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
    </div>
  );
}
