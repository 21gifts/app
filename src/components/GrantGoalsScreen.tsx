'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ShopActivityChart } from '@/components/ShopActivityChart';
import { Button, Card } from '@/components/ui';
import { fetchGrantContinuation } from '@/lib/api';
import type { GrantContinuation } from '@/lib/api-types';
import { utcDayFromMs } from '@/lib/payout-goal';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in grant goal: ten active shops, what a transaction is, how many
 * shops meet 5 of the last 7 UTC days, and those seven daily shop counts.
 *
 * The series comes from {@link fetchGrantContinuation}, not the public
 * shop-activity chart. Renders nothing without a session.
 *
 * @returns The goals card, or `null` without a session.
 */
export function GrantGoalsScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const [goal, setGoal] = useState<GrantContinuation | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    setError(false);
    void (async () => {
      try {
        const next = await fetchGrantContinuation(session);
        if (cancelled) {
          return;
        }
        setGoal(next);
      } catch {
        if (cancelled) {
          return;
        }
        setGoal(null);
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  if (session === null) {
    return null;
  }

  const shell =
    'flex w-full flex-col gap-3 rounded-3xl border border-app-border-strong bg-app-card-muted p-4';
  let measurement: ReactElement;
  if (error && goal === null) {
    measurement = (
      <div
        className={`${shell} items-center`}
        role="group"
        aria-label={t('funding.goals.widgetLabel')}
      >
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('funding.goals.error')}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setAttempt((current) => current + 1);
          }}
        >
          {t('moderate.goal.retry')}
        </Button>
      </div>
    );
  } else if (goal === null) {
    measurement = (
      <div className={shell} role="group" aria-label={t('funding.goals.widgetLabel')}>
        <p className="text-center text-sm text-app-muted">{t('moderate.goal.loading')}</p>
      </div>
    );
  } else {
    const today = utcDayFromMs(Date.now());
    measurement = (
      <div className={shell} role="group" aria-label={t('funding.goals.widgetLabel')}>
        <p className="text-center text-sm text-app-fg">
          {t('funding.goals.qualifying', { count: goal.qualifyingShops })}
        </p>
        <p className="text-sm font-medium text-app-fg">{t('funding.goals.chartLabel')}</p>
        <ShopActivityChart
          rows={goal.days.map((row) => ({ day: row.day, count: row.shopCount }))}
          today={today}
          locale={locale}
          ariaLabel={t('funding.goals.chartLabel')}
        />
        <p className="text-sm text-app-muted">{t('funding.goals.chartFoot')}</p>
      </div>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('funding.goals.heading')}
      </h1>
      <p className="text-center text-sm text-app-fg">{t('funding.goals.lead')}</p>
      <p className="text-center text-sm text-app-muted">{t('funding.goals.active')}</p>
      <p className="text-center text-sm text-app-muted">{t('funding.goals.transaction')}</p>
      {measurement}
    </Card>
  );
}
