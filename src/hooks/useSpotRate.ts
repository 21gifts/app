'use client';

import { useEffect, useState } from 'react';
import { fetchFxSpot } from '@/lib/api';
import { spotRateDay, type FiatRateDay } from '@/lib/stats-money';

/** How often a mounted screen asks for the current price again. */
export const SPOT_REFRESH_MS = 5 * 60_000;

/**
 * Current price of 1 BTC for preferred-fiat conversion, or `null`.
 *
 * Fetches `GET /fx/spot` on mount and again every {@link SPOT_REFRESH_MS}
 * while mounted, and returns {@link spotRateDay} of its rates. An answer
 * replaces the rate, including an answer without any usable price. A failed
 * request keeps the last rate, so an amount being typed does not lose it.
 * Never throws into the caller, not even when the request throws at once.
 * Drops answers after unmount.
 *
 * @param enabled - When false, skip the fetch and stay `null`. Default true.
 * @returns The current rate, or `null` without a usable price.
 */
export function useSpotRate(enabled = true): FiatRateDay | null {
  const [rate, setRate] = useState<FiatRateDay | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    const load = (): void => {
      Promise.resolve()
        .then(fetchFxSpot)
        .then((spot) => {
          if (!cancelled) {
            setRate(spotRateDay(spot.rates));
          }
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, SPOT_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return rate;
}
