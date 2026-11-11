'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { StatsDashboard } from '@/components/StatsDashboard';
import { fetchGiftStats, fetchPostStats, fetchWalletStats } from '@/lib/api';
import type { GiftStats, PostStats, WalletStats } from '@/lib/api-types';

/**
 * Client loader for `/stats`: fetches gift totals and renders the dashboard.
 *
 * @returns The dashboard, or loading/error states inside it.
 */
export function StatsLoader(): ReactElement {
  const [stats, setStats] = useState<GiftStats | null>(null);
  const [posts, setPosts] = useState<PostStats | null>(null);
  const [wallets, setWallets] = useState<WalletStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [next, postStats, walletStats] = await Promise.all([
          fetchGiftStats(),
          fetchPostStats().catch(() => null),
          fetchWalletStats().catch(() => null),
        ]);
        if (!cancelled) {
          setStats(next);
          setPosts(postStats);
          setWallets(walletStats);
        }
      } catch (cause) {
        if (!cancelled) {
          setStats(null);
          setPosts(null);
          setWallets(null);
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load donation stats. Please try again.',
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
  }, [attempt]);

  return (
    <StatsDashboard
      stats={stats}
      posts={posts}
      wallets={wallets}
      error={error}
      loading={loading}
      onRetry={() => {
        setAttempt((n) => n + 1);
      }}
    />
  );
}
