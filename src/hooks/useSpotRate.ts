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
 * while mounted, and returns {@link spotRateDay} of its rates. An answer with
 * a usable price replaces the rate. An answer without any price (the api has
 * no quote) and a failed request keep the last rate, as the api itself keeps
 * its last good quote. A refresh does not start while the previous
 * request is still open, so an older answer cannot replace a newer one.
 * Never throws into the caller, not even when the request throws at once.
 * Drops answers after unmount.
 *
 * @param enabled - When false, skip the fetch and return `null`, also after a
 *   rate was loaded. Default true.
 * @returns The current rate, or `null` without a usable price.
 */
export function useSpotRate(enabled = true): FiatRateDay | null {
  const [rate, setRate] = useState<FiatRateDay | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const load = (): void => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      Promise.resolve()
        .then(fetchFxSpot)
        .then((spot) => {
          const next = spotRateDay(spot.rates);
          if (!cancelled && next !== null) {
            setRate(next);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };
    load();
    const timer = window.setInterval(load, SPOT_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return enabled ? rate : null;
}
