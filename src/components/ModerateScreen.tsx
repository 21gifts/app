'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations, type LocaleContextValue } from '@/components/LocaleProvider';
import { PayoutGoalChart } from '@/components/PayoutGoalChart';
import { Button, ButtonLink, Card } from '@/components/ui';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { fetchGiftStats } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import {
  PAYOUT_GOAL,
  chartRows,
  countOnDay,
  formatUtcDate,
  previousUtcDay,
  utcDayFromMs,
} from '@/lib/payout-goal';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in moderation hub of staff tools.
 *
 * Moderators see the daily payout-goal widget (from
 * {@link fetchGiftStats}), and labeled Hidden notes, Open proposals,
 * Moderators chat group, and Handbook tools. The Open proposals
 * control goes to `/moderate/proposals` and shows `proposalCount` when greater
 * than zero. The Moderators chat group control goes to `/moderate/group` and
 * shows a staff-room unread count when greater than zero. Handbook goes to
 * `/moderate/handbook`. Other signed-in visitors see a short forbidden message
 * and no tools list. Does not fetch hidden notes, proposals, or
 * the group thread; unread for Open proposals and Moderators chat group comes
 * from {@link useUnreadCount}. When the payout-goal chart is open, a
 * secondary ButtonLink under the chart foot goes to `/moderate/payouts`; it is
 * not in the toggle and is hidden on the loading and error stand-ins. Renders
 * nothing without a session.
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
  const { moderationUnreadCount, proposalCount } = useUnreadCount(true, { writeBadge: false });
  const groupUnreadCount = moderationUnreadCount - proposalCount;

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
          <ButtonLink
            href="/moderate/proposals"
            variant="secondary"
            size="lg"
            {...(proposalCount > 0
              ? {
                  'aria-label': t('moderate.proposals.unread', { count: String(proposalCount) }),
                }
              : {})}
          >
            {t('moderate.proposals.heading')}
            {proposalCount > 0 ? (
              <span className="font-semibold tabular-nums lining-nums">{proposalCount}</span>
            ) : null}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink
            href="/moderate/group"
            variant="secondary"
            size="lg"
            {...(groupUnreadCount > 0
              ? {
                  'aria-label': t('moderate.groupUnread', { count: String(groupUnreadCount) }),
                }
              : {})}
          >
            {t('moderate.groupLabel')}
            {groupUnreadCount > 0 ? (
              <span className="font-semibold tabular-nums lining-nums">{groupUnreadCount}</span>
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
 * The payout-per-person ButtonLink sits only in the open chart.
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
  const errorPanel = (
    <div className={`${shell} items-center`} {...labeled}>
      <p role="alert" className="text-center text-sm text-app-danger">
        {t('moderate.goal.error')}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t('moderate.goal.retry')}
      </Button>
    </div>
  );

  if (error && stats === null) {
    return errorPanel;
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
  if (count === null) {
    return errorPanel;
  }
  const rows = chartRows(stats.spendOverTime, today);
  const percent = Math.min(100, Math.round((count / PAYOUT_GOAL) * 100));

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
          <p className="shrink-0 text-2xl font-semibold tabular-nums lining-nums text-app-fg">
            {t('moderate.goal.percent', { percent })}
          </p>
        </div>
        <div className="flex w-full items-baseline justify-between gap-2">
          <p className="min-w-0 whitespace-nowrap text-xs text-app-muted sm:text-sm">
            {t('moderate.goal.subtitle')}
          </p>
          <p className="shrink-0 whitespace-nowrap text-right text-xs text-app-muted">
            {t('moderate.goal.yesterdayOf', { count, goal: PAYOUT_GOAL })}
          </p>
        </div>
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
          <div className="flex w-full flex-col items-center gap-3">
            <ButtonLink href="/moderate/payouts" variant="secondary" size="lg">
              {t('moderate.payouts.link')}
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
