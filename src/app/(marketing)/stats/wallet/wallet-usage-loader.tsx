'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { WalletUsageDashboard } from '@/components/WalletUsageDashboard';
import { fetchWalletStats, fetchWalletUsage } from '@/lib/api';
import type { WalletStats, WalletUsage } from '@/lib/api-types';

/**
 * Client loader for `/stats/wallet`.
 *
 * A failed usage fetch shows one quiet error line. A failed wallet-stats
 * fetch only hides the wallets-per-day chart.
 *
 * @returns The dashboard, or its loading or error line.
 */
export function WalletUsageLoader(): ReactElement {
  const [usage, setUsage] = useState<WalletUsage | null>(null);
  const [wallets, setWallets] = useState<WalletStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [nextUsage, nextWallets] = await Promise.all([
          fetchWalletUsage(),
          fetchWalletStats().catch(() => null),
        ]);
        if (!cancelled) {
          setUsage(nextUsage);
          setWallets(nextWallets);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setUsage(null);
          setWallets(null);
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load wallet usage. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WalletUsageDashboard usage={usage} wallets={wallets} error={error} loading={loading} />
  );
}
