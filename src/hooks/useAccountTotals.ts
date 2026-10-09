'use client';

import { useEffect, useState } from 'react';
import { fetchAccountActivity } from '@/lib/api';
import type { AccountActivity } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches given/received and loan balance activity for the signed-in session.
 *
 * Calls `GET /me/activity` whenever a session exists, including when the
 * Lightning Address is blank (forum zaps do not need a handle). Refetches when
 * the session or Lightning Address changes so house gifts to a newly linked
 * handle appear without a full reload. No session → zeros, empty series,
 * `loading: false`, `failed: false`. On each fetch start (including session
 * or address change) totals and series reset to zeros/empty and `failed` is
 * false; `AccountActivityChart` / `LoanBalanceChart` then show empty copy (no
 * SVG) while the request is in flight. Drops stale responses when the session
 * or address changes mid-flight. A thrown fetch sets `failed` true with zeros
 * and empty series so both charts show their error copy. Missing loan fields
 * on older payloads become saldo `0` and empty loan series. Does not call
 * `fetchGiftStats`.
 *
 * @returns Current gift and loan totals, all four time series, an in-flight
 *   `loading` flag, and a `failed` flag for a thrown fetch.
 */
export function useAccountTotals(): {
  donatedSats: number;
  receivedSats: number;
  owedSats: number;
  creditSats: number;
  donateOverTime: AccountActivity['donatedOverTime'];
  receiveOverTime: AccountActivity['receivedOverTime'];
  owedOverTime: NonNullable<AccountActivity['owedOverTime']>;
  creditOverTime: NonNullable<AccountActivity['creditOverTime']>;
  loading: boolean;
  failed: boolean;
} {
  const session = useAuthStore((state) => state.session);
  const lightningAddress = useAuthStore((state) => state.account?.lightningAddress ?? null);
  const [donatedSats, setDonatedSats] = useState(0);
  const [receivedSats, setReceivedSats] = useState(0);
  const [owedSats, setOwedSats] = useState(0);
  const [creditSats, setCreditSats] = useState(0);
  const [donateOverTime, setDonateOverTime] = useState<AccountActivity['donatedOverTime']>([]);
  const [receiveOverTime, setReceiveOverTime] = useState<AccountActivity['receivedOverTime']>([]);
  const [owedOverTime, setOwedOverTime] = useState<NonNullable<AccountActivity['owedOverTime']>>(
    [],
  );
  const [creditOverTime, setCreditOverTime] = useState<
    NonNullable<AccountActivity['creditOverTime']>
  >([]);
  const [loading, setLoading] = useState(session !== null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (session === null) {
      setDonatedSats(0);
      setReceivedSats(0);
      setOwedSats(0);
      setCreditSats(0);
      setDonateOverTime([]);
      setReceiveOverTime([]);
      setOwedOverTime([]);
      setCreditOverTime([]);
      setLoading(false);
      setFailed(false);
      return () => {
        cancelled = true;
      };
    }

    setDonatedSats(0);
    setReceivedSats(0);
    setOwedSats(0);
    setCreditSats(0);
    setDonateOverTime([]);
    setReceiveOverTime([]);
    setOwedOverTime([]);
    setCreditOverTime([]);
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
        setOwedSats(activity.owedSats ?? 0);
        setCreditSats(activity.creditSats ?? 0);
        setDonateOverTime(activity.donatedOverTime);
        setReceiveOverTime(activity.receivedOverTime);
        setOwedOverTime(activity.owedOverTime ?? []);
        setCreditOverTime(activity.creditOverTime ?? []);
        setFailed(false);
      } catch {
        if (cancelled) {
          return;
        }
        setDonatedSats(0);
        setReceivedSats(0);
        setOwedSats(0);
        setCreditSats(0);
        setDonateOverTime([]);
        setReceiveOverTime([]);
        setOwedOverTime([]);
        setCreditOverTime([]);
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
  }, [session, lightningAddress]);

  return {
    donatedSats,
    receivedSats,
    owedSats,
    creditSats,
    donateOverTime,
    receiveOverTime,
    owedOverTime,
    creditOverTime,
    loading,
    failed,
  };
}
