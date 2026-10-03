import type { ReactElement } from 'react';
import type { Locale } from '@/lib/locale';
import { chartDayLabel } from '@/lib/payout-goal';

/**
 * Count bars for shop activity over a UTC-day window.
 *
 * @param props - Chart rows and today's UTC day (drawn lighter).
 * @returns SVG figure.
 */
export function ShopActivityChart(props: {
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
  const scale = Math.max(1, ...rows.map((row) => row.count));
  const mid = Math.round(scale / 2);
  const ticks = [
    ...new Set(scale >= 2 && mid !== 0 && mid !== scale ? [0, mid, scale] : [0, scale]),
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
    >
      {ticks.map((tick) => {
        const y = padT + innerH - (tick / scale) * innerH;
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
      {rows.map((row, i) => {
        const displayH = row.count > 0 ? Math.max((row.count / scale) * innerH, 3) : 0;
        const x = padL + i * slot + slot * 0.18;
        const y = padT + innerH - displayH;
        const isToday = row.day === today;
        return (
          <g key={row.day}>
            {row.count > 0 ? (
              <rect
                x={x}
                y={y}
                width={barW}
                height={displayH}
                rx={3}
                className={isToday ? 'fill-app-subtle' : 'fill-app-accent'}
                data-testid="shop-activity-chart-bar"
              />
            ) : null}
            {row.count > 0 && (isToday || row.count === scale) ? (
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
