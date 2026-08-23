'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { StatsDashboard } from '@/components/StatsDashboard';
import { fetchGiftStats } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';

/**
 * `/stats` — public gift totals and diagrams.
 *
 * @returns The statistics screen.
 */
export default function StatsPage(): ReactElement {
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
    <main className="mx-auto max-w-[1100px] px-5 pt-16 pb-24">
      <h1 className="text-4xl font-semibold tracking-tight">Gifts</h1>
      <p className="mt-3 max-w-2xl text-lg text-white/60">How much has been given, over time.</p>
      <div className="mt-12">
        <StatsDashboard
          stats={stats}
          error={error}
          loading={loading}
          onRetry={() => {
            setAttempt((n) => n + 1);
          }}
        />
      </div>
    </main>
  );
}
