import type { ReactElement } from 'react';
import type { Locale } from '@/lib/locale';
import { PAYOUT_GOAL, chartDayLabel } from '@/lib/payout-goal';

/**
 * Count bars for one UTC-day window against the daily person goal.
 *
 * @param props - Chart rows and today's UTC day (drawn lighter).
 * @returns SVG figure.
 */
export function PayoutGoalChart(props: {
  rows: { day: string; count: number }[];
  today: string;
  locale: Locale;
  ariaLabel: string;
}): ReactElement {
  const { rows, today, locale, ariaLabel } = props;
  const width = 800;
  const height = 280;
  const padL = 56;
  const padR = 16;
  const padT = 24;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = rows.length;
  const slot = innerW / Math.max(n, 1);
  const barW = slot * 0.64;
  const labelAt = new Set([0, Math.floor((n - 1) / 2), n - 1]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
    >
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = padT + innerH - (tick / PAYOUT_GOAL) * innerH;
        return (
          <g key={tick}>
            <line
              x1={padL}
              x2={padL + innerW}
              y1={y}
              y2={y}
              className="stroke-app-border"
              strokeWidth="1"
            />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-app-muted" fontSize="12">
              {tick}
            </text>
          </g>
        );
      })}
      <line
        x1={padL}
        x2={padL + innerW}
        y1={padT}
        y2={padT}
        className="stroke-app-accent"
        strokeWidth="2"
      />
      {rows.map((row, i) => {
        const h = (Math.min(row.count, PAYOUT_GOAL) / PAYOUT_GOAL) * innerH;
        const displayH = row.count > 0 ? Math.max(h, 3) : 0;
        const x = padL + i * slot + slot * 0.18;
        const y = padT + innerH - displayH;
        const isToday = row.day === today;
        return (
          <g key={row.day}>
            {displayH > 0 ? (
              <rect
                x={x}
                y={y}
                width={barW}
                height={displayH}
                rx={3}
                className={isToday ? 'fill-app-subtle' : 'fill-app-accent'}
                data-testid="payout-goal-chart-bar"
              />
            ) : null}
            {row.count >= 30 || isToday ? (
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-app-muted"
                fontSize="11"
              >
                {row.count}
              </text>
            ) : null}
            {labelAt.has(i) ? (
              <text
                x={x + barW / 2}
                y={height - 10}
                textAnchor="middle"
                className="fill-app-muted"
                fontSize="12"
              >
                {chartDayLabel(row.day, locale)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
