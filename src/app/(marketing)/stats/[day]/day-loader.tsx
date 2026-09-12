'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { FiatPicker } from '@/components/FiatPicker';
import { GiftDayTable } from '@/components/GiftDayTable';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { fetchGiftDay } from '@/lib/api';
import type { GiftDay } from '@/lib/api-types';
import {
  defaultFiatForLocale,
  formatBitcoin,
  formatFiatDisplay,
  type FiatCode,
} from '@/lib/stats-money';
import { isUtcDay } from '@/lib/utc-day';

/** Props for {@link DayLoader}. */
export interface DayLoaderProps {
  /** UTC day from the URL. */
  day: string;
}

/**
 * Selected fiat total for one UTC day.
 *
 * @param payload - Day payload.
 * @param fiat - Selected code.
 * @returns Two-decimal string, or `null` when unsummed.
 */
function dayTotal(payload: GiftDay, fiat: FiatCode): string | null {
  switch (fiat) {
    case 'USD':
      return payload.totalUsd;
    case 'CHF':
      return payload.totalChf;
    case 'EUR':
      return payload.totalEur;
    case 'PHP':
      return payload.totalPhp;
  }
}

/**
 * Client loader for `/stats/[day]`: fetches that day's gifts and a date input.
 *
 * @param props - UTC `day`.
 * @returns Loading, error, empty, or table UI.
 */
export function DayLoader({ day }: DayLoaderProps): ReactElement {
  const router = useRouter();
  const { locale } = useTranslations();
  const [fiat, setFiat] = useState<FiatCode>(() => defaultFiatForLocale(locale));
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
        <div className="mt-8 space-y-4">
          <FiatPicker value={fiat} onChange={setFiat} />
          <p className="text-paper/60">
            {payload.giftCount} gift{payload.giftCount === 1 ? '' : 's'} ·{' '}
            {formatBitcoin(payload.totalSats)} · {formatFiatDisplay(dayTotal(payload, fiat), fiat)}
          </p>
          <GiftDayTable day={payload} fiat={fiat} />
        </div>
      ) : null}
    </div>
  );
}
