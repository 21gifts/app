'use client';

import { useEffect, useState } from 'react';
import { fetchAccountActivity } from '@/lib/api';
import type { AccountActivity } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches given and received activity for the signed-in session.
 *
 * Calls `GET /me/activity` whenever a session exists, including before the
 * wallet is verified (forum gifts do not need it). Refetches when the session
 * changes or the account's wallet becomes verified (`sparkWalletVerified`) so
 * gifts to the newly set up wallet appear without a full reload. No session →
 * zeros, empty series, `loading: false`, `failed: false`. On each fetch start
 * (including a session or verification change) totals and series reset to
 * zeros/empty and `failed` is false; `AccountActivityChart` then shows
 * `profile.chartEmpty` (no SVG) while the request is in flight. Drops stale
 * responses when the session or verification changes mid-flight. A thrown
 * fetch sets `failed` true with zeros and empty
 * series so the chart shows `profile.chartError`. Does not call
 * `fetchGiftStats`.
 *
 * @returns Current totals, both time series, an in-flight `loading` flag, and
 *   a `failed` flag for a thrown fetch.
 */
export function useAccountTotals(): {
  donatedSats: number;
  receivedSats: number;
  donateOverTime: AccountActivity['donatedOverTime'];
  receiveOverTime: AccountActivity['receivedOverTime'];
  loading: boolean;
  failed: boolean;
} {
  const session = useAuthStore((state) => state.session);
  const walletVerified = useAuthStore((state) => state.account?.sparkWalletVerified === true);
  const [donatedSats, setDonatedSats] = useState(0);
  const [receivedSats, setReceivedSats] = useState(0);
  const [donateOverTime, setDonateOverTime] = useState<AccountActivity['donatedOverTime']>([]);
  const [receiveOverTime, setReceiveOverTime] = useState<AccountActivity['receivedOverTime']>([]);
  const [loading, setLoading] = useState(session !== null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (session === null) {
      setDonatedSats(0);
      setReceivedSats(0);
      setDonateOverTime([]);
      setReceiveOverTime([]);
      setLoading(false);
      setFailed(false);
      return () => {
        cancelled = true;
      };
    }

    setDonatedSats(0);
    setReceivedSats(0);
    setDonateOverTime([]);
    setReceiveOverTime([]);
    setFailed(false);
    setLoading(true);
    void (async () => {
      try {
        const activity = await fetchAccountActivity(session);
        if (cancelled) {
          return;
        }
        setDonatedSats(activity.donatedSats);
        setReceivedSats(activity.receivedSats);
        setDonateOverTime(activity.donatedOverTime);
        setReceiveOverTime(activity.receivedOverTime);
        setFailed(false);
      } catch {
        if (cancelled) {
          return;
        }
        setDonatedSats(0);
        setReceivedSats(0);
        setDonateOverTime([]);
        setReceiveOverTime([]);
        setFailed(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, walletVerified]);

  return { donatedSats, receivedSats, donateOverTime, receiveOverTime, loading, failed };
}
