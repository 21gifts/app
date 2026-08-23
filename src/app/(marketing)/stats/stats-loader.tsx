'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { StatsDashboard } from '@/components/StatsDashboard';
import { fetchGiftStats } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';

/**
 * Client loader for `/stats`: fetches gift totals and renders the dashboard.
 *
 * @returns The dashboard, or loading/error states inside it.
 */
export function StatsLoader(): ReactElement {
  const [stats, setStats] = useState<GiftStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const next = await fetchGiftStats();
        if (!cancelled) {
          setStats(next);
        }
      } catch (cause) {
        if (!cancelled) {
          setStats(null);
          setError(
            cause instanceof Error ? cause.message : 'Could not load gift stats. Please try again.',
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
      error={error}
      loading={loading}
      onRetry={() => {
        setAttempt((n) => n + 1);
      }}
    />
  );
}
