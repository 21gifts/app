'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { GiftDayTable } from '@/components/GiftDayTable';
import { Button } from '@/components/ui';
import { fetchGiftDay } from '@/lib/api';
import type { GiftDay } from '@/lib/api-types';
import { formatBitcoin } from '@/lib/stats-money';
import { isUtcDay } from '@/lib/utc-day';

/** Props for {@link DayLoader}. */
export interface DayLoaderProps {
  /** UTC day from the URL. */
  day: string;
}

/**
 * Client loader for `/stats/[day]`: fetches that day's gifts and a date input.
 *
 * @param props - UTC `day`.
 * @returns Loading, error, empty, or table UI.
 */
export function DayLoader({ day }: DayLoaderProps): ReactElement {
  const router = useRouter();
  const [payload, setPayload] = useState<GiftDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const next = await fetchGiftDay(day);
        if (!cancelled) {
          setPayload(next);
        }
      } catch (cause) {
        if (!cancelled) {
          setPayload(null);
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
  }, [attempt, day]);

  return (
    <div className="mt-8">
      <label className="block text-sm text-paper/60">
        UTC day
        <input
          type="date"
          value={day}
          aria-label="UTC day"
          className="mt-2 block rounded-md border border-paper/20 bg-transparent px-3 py-2 text-paper"
          onChange={(event) => {
            const next = event.target.value;
            if (isUtcDay(next) && next !== day) {
              router.push(`/stats/${next}`);
            }
          }}
        />
      </label>
      {loading ? <p className="mt-8 text-paper/60">Loading…</p> : null}
      {!loading && error !== null ? (
        <div className="mt-8">
          <p className="text-paper/80">{error}</p>
          <Button
            type="button"
            variant="accent"
            tone="dark"
            className="mt-3"
            onClick={() => {
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {!loading && error === null && payload !== null && payload.day === day ? (
        <div className="mt-8">
          <p className="mb-4 text-paper/60">
            {payload.giftCount} gift{payload.giftCount === 1 ? '' : 's'} ·{' '}
            {formatBitcoin(payload.totalSats)} · {payload.totalUsd} USD
          </p>
          <GiftDayTable day={payload} />
        </div>
      ) : null}
    </div>
  );
}
