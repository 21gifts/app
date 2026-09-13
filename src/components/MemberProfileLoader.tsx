'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import { Button } from '@/components/ui';
import { fetchMember, fetchMemberActivity } from '@/lib/api';
import type { GiftStats, MemberProfile } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

const ACCOUNT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client loader for `/members/[accountId]`: validates the id, fetches the
 * member profile, then given + received activity for the chart (even when the
 * Lightning Address is blank).
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
  const [donated, setDonated] = useState<GiftStats['spendOverTime']>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ACCOUNT_ID_RE.test(accountId)) {
      setStatus('missing');
      setProfile(null);
      setReceived([]);
      setDonated([]);
      return;
    }
    if (session === null) {
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setProfile(null);
    setReceived([]);
    setDonated([]);

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
        setDonated([]);

        try {
          const activity = await fetchMemberActivity(session, accountId);
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
    /* router.replace is used on 409; next/navigation's identity is not stable */
  }, [accountId, attempt, session]);

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

  const readyProfile = profile as MemberProfile;

  return <MemberProfileScreen profile={readyProfile} received={received} donated={donated} />;
}
