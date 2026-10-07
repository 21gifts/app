'use client';

import { useEffect, useState } from 'react';
import { fetchGiftStats } from '@/lib/api';
import { latestRateDay, type FiatRateDay } from '@/lib/stats-money';

/** Latest rate day and whether its fetch has settled. */
export interface LatestRateDayState {
  /** Latest rate day, or `null` while loading or without a usable rate. */
  rateDay: FiatRateDay | null;
  /** True once the fetch resolved or failed; false while it is in flight or disabled. */
  settled: boolean;
}

/**
 * Fetches the latest rate day once while enabled. `trackSettled` false keeps
 * `settled` at false, so a caller that reads only the rate re-renders no
 * more often than before the flag existed.
 *
 * @param enabled - When false, skip the fetch.
 * @param trackSettled - Whether to record that the fetch settled.
 * @returns The latest rate day and the settled flag.
 */
function useRateDayFetch(enabled: boolean, trackSettled: boolean): LatestRateDayState {
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
          if (trackSettled) {
            setSettled(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRateDay(null);
          if (trackSettled) {
            setSettled(true);
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, trackSettled]);

  return { rateDay, settled };
}

/**
 * Latest gift-day totals for preferred-fiat conversion, and whether the
 * fetch has settled.
 *
 * Fetches `GET /gifts/stats` once on mount and keeps {@link latestRateDay}
 * of `spendOverTime`. `rateDay` is `null` while loading, when no day has a
 * usable rate, or when the fetch fails; `settled` tells loading apart from
 * the other two, so a payment screen can wait for the rate before it shows
 * an amount. Never throws into the caller. Drops the response after unmount
 * via a cancelled flag.
 *
 * @param enabled - When false, skip the fetch and stay unsettled. Default true.
 * @returns The latest rate day and the settled flag.
 */
export function useLatestRateDayState(enabled = true): LatestRateDayState {
  return useRateDayFetch(enabled, true);
}

/**
 * Latest gift-day totals for preferred-fiat conversion, or `null`.
 *
 * The same fetch as {@link useLatestRateDayState} without the settled flag:
 * `null` while loading, when no day has a usable rate yet, or when the fetch
 * fails.
 *
 * @param enabled - When false, skip the fetch and stay `null`. Default true.
 * @returns The latest rate day, or `null` without a usable rate.
 */
export function useLatestRateDay(enabled = true): FiatRateDay | null {
  return useRateDayFetch(enabled, false).rateDay;
}
