'use client';

import { useState, type ReactElement } from 'react';
import { FiatPicker } from '@/components/FiatPicker';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { SegmentedControl } from '@/components/ui';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { alignLoanSeries, loanAxis, loanValue, type ActivityScale } from '@/lib/account-activity';
import type { AccountActivity } from '@/lib/api-types';
import { formatBitcoin, formatFiatTick, formatUsdTick } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link LoanBalanceChart}. */
export interface LoanBalanceChartProps {
  /** Cumulative debt series from account activity. Defaults to `[]`. */
  owed?: NonNullable<AccountActivity['owedOverTime']>;
  /** Cumulative credit series from account activity. Defaults to `[]`. */
  credit?: NonNullable<AccountActivity['creditOverTime']>;
  /**
   * When true and the series is empty or all-zero sats, show
   * `profile.loanChartError` instead of `profile.loanChartEmpty`. Ignored when
   * any cumulative sats are non-zero. Defaults to false (in-flight and
   * successful empty still use `profile.loanChartEmpty`).
   */
  failed?: boolean;
}

const DEBT_STROKE = 'var(--color-app-chart-given)';
const CREDIT_STROKE = 'var(--color-app-chart-received)';
const WIDTH = 400;
const HEIGHT = 110;
const PAD_L = 56;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 20;

/**
 * Compact dual-line open-balance chart of Debt and Credit. FiatPicker only
 * when hydration is ready AND session is null (unsigned public view).
 * Signed-in mounts omit it. Fiat code comes from {@link useFiatPreference}.
 * Y-axis always includes 0 and may extend below for negative balances. Circles
 * mark every value change (rise or fall), not only increases.
 *
 * @param props - Owed series, credit series, and optional `failed`.
 * @returns When unsigned, FiatPicker then empty `profile.loanChartEmpty`
 *   status, failed-empty `profile.loanChartError` alert, or FiatPicker plus
 *   legend, selected-fiat chrome, and reserved-height SVG. Signed-in empty is
 *   `profile.loanChartEmpty` alone (or `profile.loanChartError` when
 *   `failed`); populated signed-in starts at legend + ₿\|selected fiat scale
 *   (no title heading).
 */
export function LoanBalanceChart({
  owed = [],
  credit = [],
  failed = false,
}: LoanBalanceChartProps): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat, setFiat } = useFiatPreference();
  const { ready } = useHydrateSession();
  const session = useAuthStore((state) => state.session);
  const showFiatSwitcher = ready && session === null;
  const [scale, setScale] = useState<ActivityScale>('sat');
  const points = alignLoanSeries(owed, credit);
  const emptySats =
    points.length === 0 ||
    points.every((point) => point.cumulativeOwedSats === 0 && point.cumulativeCreditSats === 0);

  const picker = showFiatSwitcher ? (
    <FiatPicker value={fiat} onChange={setFiat} shell="app" ariaLabel={t('profile.fiatCurrency')} />
  ) : null;

  if (emptySats) {
    return (
      <div className="flex w-full flex-col gap-2">
        {picker}
        {failed ? (
          <p className="text-center text-sm text-app-danger" role="alert">
            {t('profile.loanChartError')}
          </p>
        ) : (
          <p className="text-center text-sm text-app-muted" role="status">
            {t('profile.loanChartEmpty')}
          </p>
        )}
      </div>
    );
  }

  const { minY, maxY, span } = loanAxis(points, scale, fiat);
  const dataMax = points.reduce(
    (acc, point) =>
      Math.max(acc, loanValue(point, 'owed', scale, fiat), loanValue(point, 'credit', scale, fiat)),
    0,
  );
  const formatTick = (value: number): string => {
    if (scale === 'sat') {
      return formatBitcoin(value, numberFormat);
    }
    return fiat === 'USD'
      ? formatUsdTick(value, numberFormat)
      : formatFiatTick(value, fiat, numberFormat);
  };
  const ariaLabel =
    scale === 'sat' ? t('profile.loanChartSat') : t('profile.loanChartFiat', { code: fiat });

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const n = points.length;
  const xAt = (i: number): number => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number): number => PAD_T + innerH - ((v - minY) / span) * innerH;

  const linePoints = (series: 'owed' | 'credit'): string => {
    if (n === 1) {
      const y = yAt(loanValue(points[0] as (typeof points)[number], series, scale, fiat)).toFixed(
        1,
      );
      return `${PAD_L},${y} ${(PAD_L + innerW).toFixed(1)},${y}`;
    }
    return points
      .map(
        (point, i) =>
          `${xAt(i).toFixed(1)},${yAt(loanValue(point, series, scale, fiat)).toFixed(1)}`,
      )
      .join(' ');
  };

  const yTicks: number[] = [];
  const yTickLabels = new Set<string>();
  const tickCandidates =
    minY < 0
      ? [minY, 0, maxY]
      : dataMax === 0
        ? [0]
        : [0, 1, 0.5].map((fraction) => maxY * fraction);
  for (const tick of tickCandidates) {
    const label = formatTick(tick);
    if (yTickLabels.has(label)) {
      continue;
    }
    yTickLabels.add(label);
    yTicks.push(tick);
  }
  const xIdx = [...new Set(n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1])];

  const owedLine = linePoints('owed');
  const creditLine = linePoints('credit');

  return (
    <div className="flex w-full flex-col gap-2">
      {picker}
      <div
        role="group"
        aria-label={t('profile.loanChartTitle')}
        className="flex w-full flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-3 text-xs text-app-muted">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm bg-app-chart-given"
              />
              {t('profile.legendDebt')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm bg-app-chart-received"
              />
              {t('profile.legendCredit')}
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
          <polyline points={owedLine} fill="none" stroke={DEBT_STROKE} strokeWidth="1.5" />
          <polyline points={creditLine} fill="none" stroke={CREDIT_STROKE} strokeWidth="1.5" />
          {points.map((point, i) => {
            const prevOwed =
              i === 0
                ? 0
                : loanValue(points[i - 1] as (typeof points)[number], 'owed', scale, fiat);
            const prevCredit =
              i === 0
                ? 0
                : loanValue(points[i - 1] as (typeof points)[number], 'credit', scale, fiat);
            const owedVal = loanValue(point, 'owed', scale, fiat);
            const creditVal = loanValue(point, 'credit', scale, fiat);
            const cx = xAt(i);
            return (
              <g key={`dots-${point.day}`}>
                {!(owedVal === prevOwed) ? (
                  <circle cx={cx} cy={yAt(owedVal)} r={2} fill={DEBT_STROKE} />
                ) : null}
                {!(creditVal === prevCredit) ? (
                  <circle cx={cx} cy={yAt(creditVal)} r={2} fill={CREDIT_STROKE} />
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
