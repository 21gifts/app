'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations, type LocaleContextValue } from '@/components/LocaleProvider';
import { Button, ButtonLink, Card } from '@/components/ui';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { fetchGiftStats } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Daily official-payout target shown on the staff hub. */
const PAYOUT_GOAL = 100;

/** How many UTC days the expanded chart covers, ending today. */
const CHART_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * UTC calendar day `YYYY-MM-DD` for an instant.
 *
 * @param ms - Epoch milliseconds.
 * @returns UTC day string.
 */
function utcDayFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * UTC calendar day immediately before `day`.
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @returns Previous UTC day.
 */
function previousUtcDay(day: string): string {
  return utcDayFromMs(Date.parse(`${day}T00:00:00.000Z`) - MS_PER_DAY);
}

/**
 * Yesterday's official payout count from a stats series.
 *
 * @param series - `spendOverTime` oldest-first.
 * @param yesterday - UTC day to look up.
 * @returns Gift count that day, or 0 when the day is missing.
 */
function countOnDay(series: GiftStats['spendOverTime'], yesterday: string): number {
  for (const point of series) {
    if (point.day === yesterday) {
      return point.giftCount ?? 0;
    }
  }
  return 0;
}

/**
 * Last `CHART_DAYS` UTC days ending on `today`, with counts from `series`.
 *
 * @param series - `spendOverTime` oldest-first.
 * @param today - UTC day of the clock.
 * @returns Oldest-first `{ day, count }` rows.
 */
function chartRows(
  series: GiftStats['spendOverTime'],
  today: string,
): { day: string; count: number }[] {
  const byDay = new Map<string, number>();
  for (const point of series) {
    byDay.set(point.day, point.giftCount ?? 0);
  }
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  const rows: { day: string; count: number }[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i -= 1) {
    const day = utcDayFromMs(todayMs - i * MS_PER_DAY);
    rows.push({ day, count: byDay.get(day) ?? 0 });
  }
  return rows;
}

/**
 * Formats a UTC calendar day for the explanation sentence.
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @param locale - Active UI locale.
 * @returns Locale date in the UTC zone.
 */
function formatUtcDate(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

/**
 * Axis tick label for a UTC day (`D.MM.`).
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @returns Short day-month label.
 */
function chartDayLabel(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

/**
 * Signed-in moderation hub of staff tools.
 *
 * Moderators see the daily payout-goal widget (from
 * {@link fetchGiftStats}), and labeled Hidden notes, Open proposals,
 * Moderators chat group, and Handbook tools. The Moderators chat group
 * control goes to `/moderate/group` and shows a staff-room unread count
 * when greater than zero. Handbook goes to `/moderate/handbook`. Other
 * signed-in visitors see a short forbidden message and no tools list.
 * Does not fetch hidden notes, proposals, or the group thread; unread for
 * the Moderators chat group control comes from {@link useUnreadCount}.
 * Renders nothing without a session.
 *
 * @returns The moderation hub card, forbidden copy, or `null` without a session.
 */
export function ModerateScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [stats, setStats] = useState<GiftStats | null>(null);
  const [goalError, setGoalError] = useState(false);
  const [goalAttempt, setGoalAttempt] = useState(0);
  const [goalOpen, setGoalOpen] = useState(false);
  const { moderationUnreadCount } = useUnreadCount(true, { writeBadge: false });

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setGoalError(false);
    void (async () => {
      try {
        const next = await fetchGiftStats();
        if (cancelled) {
          return;
        }
        setStats(next);
      } catch {
        if (cancelled) {
          return;
        }
        setStats(null);
        setGoalError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, goalAttempt]);

  if (session === null) {
    return null;
  }

  if (!staff) {
    return (
      <Card maxWidth="xl" surface={false}>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('moderate.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('moderate.heading')}
      </h1>
      <PayoutGoalWidget
        t={t}
        locale={locale}
        stats={stats}
        error={goalError}
        open={goalOpen}
        onToggle={() => {
          setGoalOpen((current) => !current);
        }}
        onRetry={() => {
          setGoalAttempt((current) => current + 1);
        }}
      />
      <ul aria-label={t('moderate.toolsLabel')} className="flex w-full flex-col gap-3">
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/hidden" variant="secondary" size="lg">
            {t('moderate.listLabel')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/proposals" variant="secondary" size="lg">
            {t('moderate.proposals.heading')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink
            href="/moderate/group"
            variant="secondary"
            size="lg"
            {...(moderationUnreadCount > 0
              ? {
                  'aria-label': t('moderate.groupUnread', { count: String(moderationUnreadCount) }),
                }
              : {})}
          >
            {t('moderate.groupLabel')}
            {moderationUnreadCount > 0 ? (
              <span className="font-semibold tabular-nums lining-nums">
                {moderationUnreadCount}
              </span>
            ) : null}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/handbook" variant="secondary" size="lg">
            {t('moderate.handbook.heading')}
          </ButtonLink>
        </li>
      </ul>
    </Card>
  );
}

/**
 * Staff payout-goal panel: yesterday versus 100, expanding to a 30-day chart.
 *
 * @param props - Catalog, locale, stats load state, and expand/retry handlers.
 * @returns The widget, or a loading/error stand-in.
 */
function PayoutGoalWidget(props: {
  t: LocaleContextValue['t'];
  locale: Locale;
  stats: GiftStats | null;
  error: boolean;
  open: boolean;
  onToggle: () => void;
  onRetry: () => void;
}): ReactElement {
  const { t, locale, stats, error, open, onToggle, onRetry } = props;
  const shell =
    'flex w-full flex-col gap-3 rounded-3xl border border-app-border-strong bg-app-card-muted p-4';
  const labeled = { role: 'group' as const, 'aria-label': t('moderate.goal.widgetLabel') };

  if (error && stats === null) {
    return (
      <div className={`${shell} items-center`} {...labeled}>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('moderate.goal.error')}
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('moderate.goal.retry')}
        </Button>
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className={shell} {...labeled}>
        <p className="text-center text-sm text-app-muted">{t('moderate.goal.loading')}</p>
      </div>
    );
  }

  const today = utcDayFromMs(Date.now());
  const yesterday = previousUtcDay(today);
  const count = countOnDay(stats.spendOverTime, yesterday);
  const percent = Math.min(100, Math.round((count / PAYOUT_GOAL) * 100));
  const rows = chartRows(stats.spendOverTime, today);

  return (
    <div className={shell} {...labeled}>
      <button
        type="button"
        className="flex w-full flex-col gap-3 text-left"
        aria-expanded={open}
        aria-controls="moderate-payout-goal-detail"
        onClick={onToggle}
      >
        <div className="flex w-full items-start justify-between gap-3">
          <p className="text-base font-semibold text-app-fg">{t('moderate.goal.title')}</p>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums lining-nums text-app-fg">
              {t('moderate.goal.percent', { percent })}
            </p>
            <p className="text-xs text-app-muted">
              {t('moderate.goal.yesterdayOf', { count, goal: PAYOUT_GOAL })}
            </p>
          </div>
        </div>
        <p className="text-sm text-app-muted">{t('moderate.goal.subtitle')}</p>
        <svg
          className="h-3 w-full"
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect width="100" height="12" rx="6" className="fill-app-border" />
          <rect
            width={percent}
            height="12"
            rx="6"
            className="fill-app-accent"
            data-testid="payout-goal-fill"
          />
        </svg>
        {open ? (
          <p className="text-center text-xs text-app-muted">{t('moderate.goal.closeHint')}</p>
        ) : null}
      </button>
      {open ? (
        <div id="moderate-payout-goal-detail" className="flex flex-col gap-3">
          <p className="text-sm text-app-muted">
            {t('moderate.goal.explYesterday', {
              date: formatUtcDate(yesterday, locale),
              count,
              percent,
              goal: PAYOUT_GOAL,
            })}
          </p>
          <p className="text-sm text-app-muted">{t('moderate.goal.explOfficial')}</p>
          <p className="text-sm text-app-muted">{t('moderate.goal.explBar')}</p>
          <p className="text-sm font-medium text-app-fg">{t('moderate.goal.chartTitle')}</p>
          <PayoutGoalChart
            rows={rows}
            today={today}
            locale={locale}
            ariaLabel={t('moderate.goal.chartTitle')}
          />
          <p className="text-center text-xs text-app-muted">
            {t('moderate.goal.chartFoot', { goal: PAYOUT_GOAL })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Count bars for one UTC-day window against the 100-payout goal.
 *
 * @param props - Chart rows and today's UTC day (drawn lighter).
 * @returns SVG figure.
 */
function PayoutGoalChart(props: {
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
  const labelAt = new Set([0, Math.floor((n - 1) / 2), n - 2]);

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
            {row.count >= 30 ? (
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
