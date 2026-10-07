'use client';

import { useEffect, useState } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { fetchGiftStats } from '@/lib/api';
import { latestRateDayFor, type FiatRateDay } from '@/lib/stats-money';

/** Gift-day rate plus whether that request has finished. */
export interface LatestRateDayState {
  /** Latest usable day, or `null` when there is none (or while loading). */
  rateDay: FiatRateDay | null;
  /** True when no fetch is in flight. A disabled hook is settled immediately. */
  settled: boolean;
  /** True until the read has settled (or while disabled), so a payment screen can wait for it. */
  loading: boolean;
}

/**
 * Latest gift-day totals, and whether the request has settled.
 *
 * Fetches `GET /gifts/stats` once while `enabled` and returns
 * {@link latestRateDayFor} of `spendOverTime` for the preferred fiat.
 * A newer day whose total for that currency is missing is skipped.
 * `settled` stays false until that request resolves or fails, so a payment
 * screen can refuse to treat the amount as ready while the rate is still
 * loading. A settled `null` means the request finished with no usable rate.
 * `loading` is the reverse view for
 * a payment screen that must wait: true until the read has settled, and also
 * while disabled. Never throws into the caller. Drops the response after unmount via a
 * cancelled flag. Changing the preferred fiat reuses the fetched series.
 *
 * @param enabled - When false, skip the fetch. Default true.
 * @returns The latest rate day, whether the request has settled, and whether it is still loading.
 */
export function useLatestRateDayState(enabled = true): LatestRateDayState {
  const { fiat } = useFiatPreference();
  const [series, setSeries] = useState<readonly FiatRateDay[] | null>(null);
  const [settled, setSettled] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setSettled(true);
      return;
    }
    let cancelled = false;
    setSettled(false);
    void fetchGiftStats()
      .then((stats) => {
        if (!cancelled) {
          setSeries(stats.spendOverTime);
          setSettled(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSeries([]);
          setSettled(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const rateDay = !enabled || series === null ? null : latestRateDayFor(series, fiat);
  return { rateDay, settled, loading: !enabled || !settled };
}

/**
 * Latest gift-day totals for preferred-fiat conversion, or `null`.
 *
 * Same fetch as {@link useLatestRateDayState}. Callers that only need the
 * day keep this wrapper. A loading day and a settled missing day are both
 * `null`; use {@link useLatestRateDayState} when that difference matters.
 *
 * @param enabled - When false, skip the fetch and stay `null`. Default true.
 * @returns The latest rate day, or `null` without a usable rate.
 */
export function useLatestRateDay(enabled = true): FiatRateDay | null {
  return useLatestRateDayState(enabled).rateDay;
}
