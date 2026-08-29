'use client';

import { useEffect, useState } from 'react';
import { fetchGiftStats } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';
import { accountTotals, recipientHandleFromAddress } from '@/lib/account-totals';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches gift stats for the signed-in Lightning Address and derives totals.
 *
 * Given is always 0 in v1. When an address is set, requests filtered stats via
 * `fetchGiftStats(handle)` and exposes `spendOverTime` as `receiveOverTime`.
 * Blank address skips the fetch (zeros, empty series, `loading: false`). Drops
 * stale responses when the store address changes mid-flight. Errors resolve to
 * zeros and an empty series without throwing into the UI. Does not clear
 * `receiveOverTime` at the start of a refetch so the chart SVG stays mounted.
 *
 * @returns Current totals, receive series, and an in-flight `loading` flag.
 */
export function useAccountTotals(): {
  donatedSats: number;
  receivedSats: number;
  receiveOverTime: GiftStats['spendOverTime'];
  loading: boolean;
} {
  const lightningAddress = useAuthStore((state) => state.account?.lightningAddress ?? null);
  const hasAddress = lightningAddress !== null && lightningAddress.trim() !== '';
  const [donatedSats, setDonatedSats] = useState(0);
  const [receivedSats, setReceivedSats] = useState(0);
  const [receiveOverTime, setReceiveOverTime] = useState<GiftStats['spendOverTime']>([]);
  const [loading, setLoading] = useState(hasAddress);

  useEffect(() => {
    let cancelled = false;
    const addressAtStart = lightningAddress;
    if (addressAtStart === null || addressAtStart.trim() === '') {
      setDonatedSats(0);
      setReceivedSats(0);
      setReceiveOverTime([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    const trimmed = addressAtStart.trim();
    const handle = recipientHandleFromAddress(trimmed);
    void (async () => {
      try {
        const stats = await fetchGiftStats(handle);
        if (cancelled) {
          return;
        }
        const totals = accountTotals(stats, trimmed);
        setDonatedSats(totals.donatedSats);
        setReceivedSats(totals.receivedSats);
        setReceiveOverTime(stats.spendOverTime);
      } catch {
        if (cancelled) {
          return;
        }
        setDonatedSats(0);
        setReceivedSats(0);
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
  }, [lightningAddress]);

  return { donatedSats, receivedSats, receiveOverTime, loading };
}
