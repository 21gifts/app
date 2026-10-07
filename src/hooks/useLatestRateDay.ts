'use client';

import { useEffect, useState } from 'react';
import { fetchGiftStats } from '@/lib/api';
import { latestRateDay, type FiatRateDay } from '@/lib/stats-money';

/** The latest rate day and whether its read has settled. */
export interface LatestRateDayState {
  /** The latest gift-day totals, or `null` without a usable rate (or while loading). */
  rateDay: FiatRateDay | null;
  /** True until the read has settled (or while disabled), so a payment screen can wait for it. */
  loading: boolean;
}

/**
 * {@link useLatestRateDay} with its load state, for a screen that must not
 * show an amount as ready while the rate is still loading.
 *
 * @param enabled - When false, skip the fetch; `loading` stays `true`. Default true.
 * @returns The rate day and whether its read is still running.
 */
export function useLatestRateDayState(enabled = true): LatestRateDayState {
  const [state, setState] = useState<LatestRateDayState>({ rateDay: null, loading: true });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    void fetchGiftStats()
      .then((stats) => {
        if (!cancelled) {
          setState({ rateDay: latestRateDay(stats.spendOverTime), loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ rateDay: null, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}

/**
 * Latest gift-day totals for preferred-fiat conversion, or `null`.
 *
 * Fetches `GET /gifts/stats` once on mount and returns
 * {@link latestRateDay} of `spendOverTime`. Resolves to `null` when no day
 * has a usable rate yet, or when the fetch fails. Never throws into the
 * caller. Drops the response after unmount via a cancelled flag.
 *
 * @param enabled - When false, skip the fetch and stay `null`. Default true.
 * @returns The latest rate day, or `null` without a usable rate.
 */
export function useLatestRateDay(enabled = true): FiatRateDay | null {
  return useLatestRateDayState(enabled).rateDay;
}
