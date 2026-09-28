'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Daily repayment as bars, and the debt still owed as a line.
 *
 * The horizontal axis is the first label to the last. Bars use the daily
 * scale. The line starts at the whole debt and ends at zero, on its own scale.
 *
 * @param props.amounts - Amount due each day, in one unit.
 * @param props.from - First day on the axis.
 * @param props.to - Last day on the axis.
 * @param props.totalText - Whole debt, already formatted.
 * @returns The chart, or null when there is nothing to draw.
 */
export function RepaymentPlanChart({
  amounts,
  from,
  to,
  totalText,
}: {
  amounts: readonly number[];
  from: string;
  to: string;
  totalText: string;
}): ReactElement | null {
  const { t } = useTranslations();
  if (amounts.length === 0 || amounts.every((amount) => !(Number.isFinite(amount) && amount > 0))) {
    return null;
  }
  const plotted = amounts.map((amount) => (Number.isFinite(amount) && amount > 0 ? amount : 0));
  const total = plotted.reduce((sum, amount) => sum + amount, 0);
  const maxBar = plotted.reduce((max, amount) => (amount > max ? amount : max), 0);
  const width = 640;
  const height = 148;
  const padL = 8;
  const padR = 8;
  const padT = 22;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const slot = innerW / plotted.length;
  const barW = Math.min(slot * 0.62, 36);
  const debtY = (remaining: number): number => padT + innerH - (remaining / total) * innerH;
  let paid = 0;
  const line = [`${padL},${debtY(total)}`];
  plotted.forEach((amount, index) => {
    paid += amount;
    line.push(`${padL + (index + 1) * slot},${debtY(total - paid)}`);
  });
  return (
    <figure className="mt-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={t('forum.creditChartAria', { from, to, total: totalText })}
      >
        <line
          x1={padL}
          x2={padL + innerW}
          y1={padT + innerH}
          y2={padT + innerH}
          className="stroke-app-border"
          strokeWidth="1"
        />
        {plotted.map((amount, index) => {
          const h = (amount / maxBar) * innerH;
          const x = padL + index * slot + (slot - barW) / 2;
          return (
            <rect
              key={index}
              x={x}
              y={padT + innerH - h}
              width={barW}
              height={h}
              rx={barW > 8 ? 3 : 1}
              className="fill-app-accent"
              data-testid="repayment-plan-bar"
            />
          );
        })}
        <polyline
          points={line.join(' ')}
          fill="none"
          className="stroke-app-fg"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          data-testid="repayment-plan-debt"
        />
        <text x={padL} y={14} className="fill-app-muted" fontSize="12">
          {totalText}
        </text>
        <text x={padL} y={height - 8} className="fill-app-muted" fontSize="12">
          {from}
        </text>
        {to !== from ? (
          <text
            x={padL + innerW}
            y={height - 8}
            textAnchor="end"
            className="fill-app-muted"
            fontSize="12"
          >
            {to}
          </text>
        ) : null}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-sm bg-app-accent" />
          {t('forum.creditChartPerDay')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-3 bg-app-fg" />
          {t('forum.creditChartDebt')}
        </span>
      </figcaption>
    </figure>
  );
}
