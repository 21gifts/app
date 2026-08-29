'use client';

import { useEffect, useState } from 'react';
import { fetchGiftStats } from '@/lib/api';
import { accountTotals } from '@/lib/account-totals';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches public gift stats and derives given/received sats for the signed-in account.
 *
 * Given is always 0 in v1. Received matches the account Lightning Address handle
 * against `byRecipient` (case-insensitive). Drops stale responses when the store
 * address changes mid-flight. Errors resolve to zeros without throwing into the UI.
 *
 * @returns Current totals and an in-flight `loading` flag.
 */
export function useAccountTotals(): {
  donatedSats: number;
  receivedSats: number;
  loading: boolean;
} {
  const lightningAddress = useAuthStore((state) => state.account?.lightningAddress ?? null);
  const [donatedSats, setDonatedSats] = useState(0);
  const [receivedSats, setReceivedSats] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const addressAtStart = lightningAddress;
    setLoading(true);
    setDonatedSats(0);
    setReceivedSats(0);
    void (async () => {
      try {
        const stats = await fetchGiftStats();
        if (cancelled) {
          return;
        }
        const totals = accountTotals(stats, addressAtStart);
        setDonatedSats(totals.donatedSats);
        setReceivedSats(totals.receivedSats);
      } catch {
        if (cancelled) {
          return;
        }
        setDonatedSats(0);
        setReceivedSats(0);
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

  return { donatedSats, receivedSats, loading };
}
