'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { ViewProfileClaim } from '@/components/ViewProfileClaim';
import { ViewProfileScreen } from '@/components/ViewProfileScreen';
import { fetchViewActivity, fetchViewProfile } from '@/lib/api';
import type { AccountActivity, ViewProfile } from '@/lib/api-types';

const VIEW_KEY_RE = /^[0-9a-f]{64}$/;

/**
 * Client loader for `/view/[viewKey]`: validates the key, fetches the public
 * profile, then given/received activity for the chart (even when the Lightning
 * Address is blank). Does not use `useAuthStore`.
 *
 * @param props - Dynamic route `viewKey`.
 * @returns Loading, missing, error, or the read-only profile card with activate/claim control.
 */
export function ViewProfileLoader({ viewKey }: { viewKey: string }): ReactElement {
  const { t } = useTranslations();
  const [status, setStatus] = useState<'loading' | 'missing' | 'error' | 'ready'>(() =>
    VIEW_KEY_RE.test(viewKey) ? 'loading' : 'missing',
  );
  const [profile, setProfile] = useState<ViewProfile | null>(null);
  const [received, setReceived] = useState<AccountActivity['receivedOverTime']>([]);
  const [donated, setDonated] = useState<AccountActivity['donatedOverTime']>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!VIEW_KEY_RE.test(viewKey)) {
      setStatus('missing');
      setProfile(null);
      setReceived([]);
      setDonated([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setProfile(null);
    setReceived([]);
    setDonated([]);

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
        setDonated([]);

        try {
          const activity = await fetchViewActivity(viewKey);
          if (cancelled) {
            return;
          }
          setReceived(activity.receivedOverTime);
          setDonated(activity.donatedOverTime);
        } catch {
          if (cancelled) {
            return;
          }
          setReceived([]);
          setDonated([]);
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
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('view.error')}
        </p>
        <Button
          type="button"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('view.retry')}
        </Button>
      </div>
    );
  }

  const readyProfile = profile as ViewProfile;

  return (
    <div className="flex flex-col items-center gap-4">
      <ViewProfileScreen
        profile={readyProfile}
        viewKey={viewKey}
        received={received}
        donated={donated}
      />
      <ViewProfileClaim viewKey={viewKey} hasPasskey={readyProfile.hasPasskey} />
    </div>
  );
}
