'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { fetchGrantPlaces } from '@/lib/api';
import type { GrantPlaces } from '@/lib/api-types';

/**
 * Public grant-places panel: the current round, how many of its places are
 * free, how many people moderators have admitted, that applications stay
 * open, and the active-shop goal that opens the next round.
 *
 * Loads {@link fetchGrantPlaces} without a session, so signed-out visitors
 * see the same numbers. While loading it shows the shared loading sentence;
 * on failure an alert and a retry button. `data-grant-places` names the
 * state (`loading`, `error`, `ready`) so screenshot tests wait for the load.
 *
 * @returns The places panel.
 */
export function GrantPlacesPanel(): ReactElement {
  const { t } = useTranslations();
  const [places, setPlaces] = useState<GrantPlaces | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    void (async () => {
      try {
        const next = await fetchGrantPlaces();
        if (cancelled) {
          return;
        }
        setPlaces(next);
      } catch {
        if (cancelled) {
          return;
        }
        setPlaces(null);
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const shell =
    'flex w-full flex-col gap-2 rounded-3xl border border-app-border-strong bg-app-card-muted p-4';
  const labeled = { role: 'group' as const, 'aria-label': t('funding.places.widgetLabel') };

  if (error && places === null) {
    return (
      <div className={`${shell} items-center`} {...labeled} data-grant-places="error">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('funding.places.error')}
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
  }

  if (places === null) {
    return (
      <div className={shell} {...labeled} data-grant-places="loading">
        <p className="text-center text-sm text-app-muted">{t('moderate.goal.loading')}</p>
      </div>
    );
  }

  return (
    <div className={shell} {...labeled} data-grant-places="ready">
      <p className="text-center text-sm font-semibold text-app-fg">
        {t('funding.places.free', {
          count: places.placesLeft,
          round: places.round,
          places: places.places,
        })}
      </p>
      <p className="text-center text-sm text-app-muted">
        {t('funding.places.admitted', { count: places.admitted })}
      </p>
      <p className="text-center text-sm text-app-muted">
        {places.placesLeft > 0
          ? t('funding.places.open', { places: places.places })
          : t('funding.places.full', { places: places.places })}
      </p>
      <p className="text-center text-sm text-app-muted">
        {t('funding.places.next', { goal: places.nextGoalShops })}
      </p>
    </div>
  );
}
