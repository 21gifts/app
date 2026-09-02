'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import { Button } from '@/components/ui';
import { recipientHandleFromAddress } from '@/lib/account-totals';
import { fetchGiftStats, fetchMember } from '@/lib/api';
import type { GiftStats, MemberProfile } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

const ACCOUNT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client loader for `/members/[accountId]`: validates the id, fetches the
 * member profile, then (if address set) filtered gift stats for the chart.
 *
 * @param props - Dynamic route `accountId`.
 * @returns Loading note, missing, error, or the member profile screen.
 */
export function MemberProfileLoader({ accountId }: { accountId: string }): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const [status, setStatus] = useState<'loading' | 'missing' | 'error' | 'ready'>(() =>
    ACCOUNT_ID_RE.test(accountId) ? 'loading' : 'missing',
  );
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [received, setReceived] = useState<GiftStats['spendOverTime']>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ACCOUNT_ID_RE.test(accountId)) {
      setStatus('missing');
      setProfile(null);
      setReceived([]);
      return;
    }
    if (session === null) {
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setProfile(null);
    setReceived([]);

    void (async () => {
      try {
        const next = await fetchMember(session, accountId);
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
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof MissingRequirementsError) {
          router.replace('/setup/rules');
          return;
        }
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, attempt, router, session]);

  if (session === null) {
    return <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  }

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

  const readyProfile = profile as MemberProfile;

  return <MemberProfileScreen profile={readyProfile} received={received} />;
}
