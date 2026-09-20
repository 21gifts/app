'use client';

import { useEffect, useState } from 'react';
import { fetchGiftStats } from '@/lib/api';
import { latestRateDay, type FiatRateDay } from '@/lib/stats-money';

/**
 * Latest gift-day totals for preferred-fiat conversion, or `null`.
 *
 * Fetches `GET /gifts/stats` once on mount and returns
 * {@link latestRateDay} of `spendOverTime`. Resolves to `null` when no day
 * has a usable rate yet, or when the fetch fails. Never throws into the
 * caller. Drops the response after unmount via a cancelled flag.
 *
 * @returns The latest rate day, or `null` without a usable rate.
 */
export function useLatestRateDay(): FiatRateDay | null {
  const [rateDay, setRateDay] = useState<FiatRateDay | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchGiftStats()
      .then((stats) => {
        if (!cancelled) {
          setRateDay(latestRateDay(stats.spendOverTime));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRateDay(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return rateDay;
}
