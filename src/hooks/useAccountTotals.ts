'use client';

import { useEffect, useState } from 'react';
import { fetchAccountActivity } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches given + received activity for the signed-in session.
 *
 * On a session (even with a blank Lightning Address) requests `/me/activity`
 * via `fetchAccountActivity` and exposes both totals and both time series.
 * No session skips the fetch (zeros, empty series, `loading: false`). On each
 * fetch start (including session change) totals and series reset to
 * zeros/empty; the profile chart SVG remains mounted on empty series. Drops
 * stale responses when the session changes mid-flight. Errors resolve to
 * zeros and empty series without throwing into the UI.
 *
 * @returns Current totals, both series, and an in-flight `loading` flag.
 */
export function useAccountTotals(): {
  donatedSats: number;
  receivedSats: number;
  donateOverTime: GiftStats['spendOverTime'];
  receiveOverTime: GiftStats['spendOverTime'];
  loading: boolean;
} {
  const session = useAuthStore((state) => state.session);
  const [donatedSats, setDonatedSats] = useState(0);
  const [receivedSats, setReceivedSats] = useState(0);
  const [donateOverTime, setDonateOverTime] = useState<GiftStats['spendOverTime']>([]);
  const [receiveOverTime, setReceiveOverTime] = useState<GiftStats['spendOverTime']>([]);
  const [loading, setLoading] = useState(session !== null);

  useEffect(() => {
    let cancelled = false;
    const sessionAtStart = session;
    if (sessionAtStart === null) {
      setDonatedSats(0);
      setReceivedSats(0);
      setDonateOverTime([]);
      setReceiveOverTime([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setDonatedSats(0);
    setReceivedSats(0);
    setDonateOverTime([]);
    setReceiveOverTime([]);
    setLoading(true);
    void (async () => {
      try {
        const activity = await fetchAccountActivity(sessionAtStart);
        if (cancelled) {
          return;
        }
        setDonatedSats(activity.donatedSats);
        setReceivedSats(activity.receivedSats);
        setDonateOverTime(activity.donatedOverTime);
        setReceiveOverTime(activity.receivedOverTime);
      } catch {
        if (cancelled) {
          return;
        }
        setDonatedSats(0);
        setReceivedSats(0);
        setDonateOverTime([]);
        setReceiveOverTime([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return { donatedSats, receivedSats, donateOverTime, receiveOverTime, loading };
}
