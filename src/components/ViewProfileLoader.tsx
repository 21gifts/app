'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ViewProfileScreen } from '@/components/ViewProfileScreen';
import { recipientHandleFromAddress } from '@/lib/account-totals';
import { fetchGiftStats, fetchViewProfile } from '@/lib/api';
import type { GiftStats, ViewProfile } from '@/lib/api-types';

const VIEW_KEY_RE = /^[0-9a-f]{64}$/;

/**
 * Client loader for `/view/[viewKey]`: validates the key, fetches the public
 * profile, then (if address set) filtered gift stats for `spendOverTime`. Does
 * not use `useAuthStore`.
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
  const [received, setReceived] = useState<GiftStats['spendOverTime']>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!VIEW_KEY_RE.test(viewKey)) {
      setStatus('missing');
      setProfile(null);
      setReceived([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setProfile(null);
    setReceived([]);

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
        setReceived([]);

        const trimmed = next.lightningAddress?.trim() ?? '';
        if (trimmed === '') {
          return;
        }

        try {
          const stats = await fetchGiftStats(recipientHandleFromAddress(trimmed));
          if (cancelled) {
            return;
          }
          setReceived(stats.spendOverTime);
        } catch {
          if (cancelled) {
            return;
          }
          setReceived([]);
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
    return <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  }

  if (status === 'missing') {
    return <p className="text-center text-sm text-app-muted">{t('view.missing')}</p>;
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-app-muted">{t('view.error')}</p>
        <button
          type="button"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
          className="rounded-full bg-app-btn px-5 py-2 text-sm font-medium text-app-btn-fg transition hover:bg-app-btn-hover"
        >
          {t('view.retry')}
        </button>
      </div>
    );
  }

  return <ViewProfileScreen profile={profile as ViewProfile} received={received} />;
}
