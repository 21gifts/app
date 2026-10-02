'use client';

import { useEffect, useState } from 'react';
import { fetchGiftStats } from '@/lib/api';
import { latestRateDay, type FiatRateDay } from '@/lib/stats-money';

/**
 * Latest gift-day totals and whether the request has finished.
 *
 * Fetches `GET /gifts/stats` once on mount and returns
 * {@link latestRateDay} of `spendOverTime`. The request is settled after
 * either a response or an error, including when no usable rate exists.
 *
 * @param enabled - When false, skip the fetch and remain unsettled. Default true.
 * @returns The latest rate day and request state.
 */
export function useLatestRateDayState(enabled = true): {
  rateDay: FiatRateDay | null;
  settled: boolean;
} {
  const [rateDay, setRateDay] = useState<FiatRateDay | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    void fetchGiftStats()
      .then((stats) => {
        if (!cancelled) {
          setRateDay(latestRateDay(stats.spendOverTime));
          setSettled(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRateDay(null);
          setSettled(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return enabled ? { rateDay, settled } : { rateDay: null, settled: false };
}

/**
 * Latest gift-day totals for preferred-fiat conversion, or `null`.
 *
 * @param enabled - When false, skip the fetch and stay `null`. Default true.
 * @returns The latest rate day, or `null` without a usable rate.
 */
export function useLatestRateDay(enabled = true): FiatRateDay | null {
  return useLatestRateDayState(enabled).rateDay;
}
