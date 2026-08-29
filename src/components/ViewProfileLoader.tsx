'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ViewProfileScreen } from '@/components/ViewProfileScreen';
import { accountTotals } from '@/lib/account-totals';
import { fetchGiftStats, fetchViewProfile } from '@/lib/api';
import type { ViewProfile } from '@/lib/api-types';

const VIEW_KEY_RE = /^[0-9a-f]{64}$/;

/**
 * Client loader for `/view/[viewKey]`: validates the key, fetches the public
 * profile, then gift stats for totals. Does not use `useAuthStore`.
 *
 * @param props - Dynamic route `viewKey`.
 * @returns Loading, missing, error, or the read-only profile card.
 */
export function ViewProfileLoader({ viewKey }: { viewKey: string }): ReactElement {
  const { t } = useTranslations();
  const [status, setStatus] = useState<'loading' | 'missing' | 'error' | 'ready'>(() =>
    VIEW_KEY_RE.test(viewKey) ? 'loading' : 'missing',
  );
  const [profile, setProfile] = useState<ViewProfile | null>(null);
  const [donatedSats, setDonatedSats] = useState(0);
  const [receivedSats, setReceivedSats] = useState(0);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!VIEW_KEY_RE.test(viewKey)) {
      setStatus('missing');
      setProfile(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setProfile(null);
    setDonatedSats(0);
    setReceivedSats(0);
    setLoadingTotals(false);

    void (async () => {
      try {
        const next = await fetchViewProfile(viewKey);
        if (cancelled) {
          return;
        }
        if (next === null) {
          setStatus('missing');
          return;
        }
        setProfile(next);
        setStatus('ready');
        setLoadingTotals(true);
        try {
          const stats = await fetchGiftStats();
          if (cancelled) {
            return;
          }
          const totals = accountTotals(stats, next.lightningAddress);
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
            setLoadingTotals(false);
          }
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewKey, attempt]);

  if (status === 'loading') {
    return <p className="text-center text-sm text-neutral-500">{t('forum.loading')}</p>;
  }

  if (status === 'missing') {
    return <p className="text-center text-sm text-neutral-500">{t('view.missing')}</p>;
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-neutral-500">{t('view.error')}</p>
        <button
          type="button"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          {t('view.retry')}
        </button>
      </div>
    );
  }

  return (
    <ViewProfileScreen
      profile={profile as ViewProfile}
      donatedSats={donatedSats}
      receivedSats={receivedSats}
      loadingTotals={loadingTotals}
    />
  );
}
