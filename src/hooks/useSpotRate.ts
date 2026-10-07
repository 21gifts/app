'use client';

import { useEffect, useState } from 'react';
import { fetchFxSpot } from '@/lib/api';
import { spotRateDay, type FiatRateDay } from '@/lib/stats-money';

/** How often a mounted screen asks for the current price again. */
export const SPOT_REFRESH_MS = 5 * 60_000;

/** The current spot rate and whether its first read has settled. */
export interface SpotRateState {
  /** The current rate, or `null` without a usable price (or while loading). */
  rateDay: FiatRateDay | null;
  /** True until the first read has settled (or while disabled), so a payment screen can wait for it. */
  loading: boolean;
}

/**
 * {@link useSpotRate} with its load state, for a screen that must not show an
 * amount as ready while the rate is still loading.
 *
 * Fetches `GET /fx/spot` on mount and again every {@link SPOT_REFRESH_MS}
 * while mounted, and keeps {@link spotRateDay} of its rates. An answer with
 * a usable price replaces the rate. An answer without any price (the api has
 * no quote) and a failed request keep the last rate, as the api itself keeps
 * its last good quote. `loading` turns false once the first read settles,
 * whatever its result. A refresh does not start while the previous request is
 * still open, so an older answer cannot replace a newer one. Never throws
 * into the caller, not even when the request throws at once. Drops answers
 * after unmount.
 *
 * @param enabled - When false, skip the fetch; `rateDay` is `null` and
 *   `loading` is `true`, also after a rate was loaded. Default true.
 * @returns The current rate and whether its first read is still running.
 */
export function useSpotRateState(enabled = true): SpotRateState {
  const [state, setState] = useState<SpotRateState>({ rateDay: null, loading: true });

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
        .then((spot) => spotRateDay(spot.rates))
        .catch(() => null)
        .then((next) => {
          if (!cancelled) {
            setState((prev) => ({ rateDay: next ?? prev.rateDay, loading: false }));
          }
        })
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

  return enabled ? state : { rateDay: null, loading: true };
}

/**
 * Current price of 1 BTC for preferred-fiat conversion, or `null`.
 *
 * The `rateDay` of {@link useSpotRateState}: the price of 1 BTC from
 * `GET /fx/spot`, refreshed every {@link SPOT_REFRESH_MS}, kept on a failed
 * read or an answer without any price.
 *
 * @param enabled - When false, skip the fetch and return `null`, also after a
 *   rate was loaded. Default true.
 * @returns The current rate, or `null` without a usable price.
 */
export function useSpotRate(enabled = true): FiatRateDay | null {
  return useSpotRateState(enabled).rateDay;
}
