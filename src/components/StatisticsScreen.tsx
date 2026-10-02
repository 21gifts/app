'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations, type LocaleContextValue } from '@/components/LocaleProvider';
import { PeopleCountChart } from '@/components/PeopleCountChart';
import { ShopActivityChart } from '@/components/ShopActivityChart';
import { Button, Card } from '@/components/ui';
import { fetchGiftStats, fetchShopActivity } from '@/lib/api';
import type { GiftStats, ShopActivityDay } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import {
  chartRows,
  countOnDay,
  formatUtcDate,
  previousUtcDay,
  utcDayFromMs,
} from '@/lib/payout-goal';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in people-count chart for staff, with shop activity under it.
 *
 * Moderators see yesterday's person count and the 30-UTC-day chart from
 * {@link fetchGiftStats}, always open, then shop counts from
 * {@link fetchShopActivity}. Each panel loads and fails on its own. Other
 * signed-in visitors see a short forbidden message. Does not fetch unless
 * the visitor is staff. Renders nothing without a session.
 *
 * @returns The statistics card, forbidden copy, or `null` without a session.
 */
export function StatisticsScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [stats, setStats] = useState<GiftStats | null>(null);
  const [goalError, setGoalError] = useState(false);
  const [goalAttempt, setGoalAttempt] = useState(0);
  const [shopDays, setShopDays] = useState<ShopActivityDay[] | null>(null);
  const [shopError, setShopError] = useState(false);
  const [shopAttempt, setShopAttempt] = useState(0);

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

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setShopError(false);
    void (async () => {
      try {
        const next = await fetchShopActivity(session);
        if (cancelled) {
          return;
        }
        setShopDays(next);
      } catch {
        if (cancelled) {
          return;
        }
        setShopDays(null);
        setShopError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, shopAttempt]);

  if (session === null) {
    return null;
  }

  if (!staff) {
    return (
      <Card maxWidth="xl" surface={false}>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('statistics.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('statistics.heading')}
      </h1>
      <PeopleCountPanel
        t={t}
        locale={locale}
        stats={stats}
        error={goalError}
        onRetry={() => {
          setGoalAttempt((current) => current + 1);
        }}
      />
      <ShopActivityPanel
        t={t}
        locale={locale}
        days={shopDays}
        error={shopError}
        onRetry={() => {
          setShopAttempt((current) => current + 1);
        }}
      />
    </Card>
  );
}

/**
 * Staff people-count panel: yesterday's count and the 30-day chart, always open.
 *
 * @param props - Catalog, locale, stats load state, and retry handler.
 * @returns The panel, or a loading/error stand-in.
 */
function PeopleCountPanel(props: {
  t: LocaleContextValue['t'];
  locale: Locale;
  stats: GiftStats | null;
  error: boolean;
  onRetry: () => void;
}): ReactElement {
  const { t, locale, stats, error, onRetry } = props;
  const shell =
    'flex w-full flex-col gap-3 rounded-3xl border border-app-border-strong bg-app-card-muted p-4';
  const labeled = { role: 'group' as const, 'aria-label': t('statistics.people.widgetLabel') };
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

  return (
    <div className={shell} {...labeled}>
      <p className="text-sm text-app-fg">
        {t('statistics.people.yesterday', {
          date: formatUtcDate(yesterday, locale),
          count,
        })}
      </p>
      <p className="text-sm text-app-muted">{t('statistics.people.explainer')}</p>
      <p className="text-sm font-medium text-app-fg">{t('statistics.people.chartLabel')}</p>
      <PeopleCountChart
        rows={rows}
        today={today}
        locale={locale}
        ariaLabel={t('statistics.people.chartLabel')}
      />
    </div>
  );
}

/**
 * Staff shop-activity panel: one explainer and the 30-day shop-count chart.
 *
 * @param props - Catalog, locale, days load state, and retry handler.
 * @returns The panel, or a loading/error stand-in.
 */
function ShopActivityPanel(props: {
  t: LocaleContextValue['t'];
  locale: Locale;
  days: ShopActivityDay[] | null;
  error: boolean;
  onRetry: () => void;
}): ReactElement {
  const { t, locale, days, error, onRetry } = props;
  const shell =
    'flex w-full flex-col gap-3 rounded-3xl border border-app-border-strong bg-app-card-muted p-4';
  const labeled = { role: 'group' as const, 'aria-label': t('statistics.shops.widgetLabel') };
  const errorPanel = (
    <div className={`${shell} items-center`} {...labeled}>
      <p role="alert" className="text-center text-sm text-app-danger">
        {t('statistics.shops.error')}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t('moderate.goal.retry')}
      </Button>
    </div>
  );

  if (error && days === null) {
    return errorPanel;
  }

  if (days === null) {
    return (
      <div className={shell} {...labeled}>
        <p className="text-center text-sm text-app-muted">{t('moderate.goal.loading')}</p>
      </div>
    );
  }

  const today = utcDayFromMs(Date.now());
  const rows = days.map((row) => ({ day: row.day, count: row.shopCount }));

  return (
    <div className={shell} {...labeled}>
      <p className="text-sm text-app-muted">{t('statistics.shops.explainer')}</p>
      <p className="text-sm font-medium text-app-fg">{t('statistics.shops.chartLabel')}</p>
      <ShopActivityChart
        rows={rows}
        today={today}
        locale={locale}
        ariaLabel={t('statistics.shops.chartLabel')}
      />
    </div>
  );
}
