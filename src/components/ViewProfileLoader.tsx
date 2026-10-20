'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { ViewProfileClaim } from '@/components/ViewProfileClaim';
import {
  fetchMember,
  fetchMemberActivity,
  fetchViewAboutMePhoto,
  fetchViewActivity,
  fetchViewForumList,
  fetchViewProfile,
} from '@/lib/api';
import {
  memberProfileSchema,
  type AccountActivity,
  type MemberProfile,
  type ViewProfile,
} from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

const VIEW_KEY_RE = /^[0-9a-f]{64}$/;

/**
 * Maps the public view-key card onto the member profile the other routes use.
 * Trust stays empty. `createdAt` becomes an ISO string. A missing id stays
 * empty so the page still renders an older short body.
 *
 * @param view - Parsed view-key profile.
 * @returns The same card shape `MemberProfileScreen` renders.
 */
function memberProfileFromView(view: ViewProfile): MemberProfile {
  return memberProfileSchema.parse({
    id: view.id ?? '',
    name: view.name,
    location: view.location,
    role: view.role ?? 'basis',
    lightningAddress: view.lightningAddressVerified ? view.lightningAddress : null,
    createdAt: new Date(view.createdAt).toISOString(),
    profileMessage: view.profileMessage ?? null,
    postCount: view.postCount ?? 0,
    replyCount: view.replyCount ?? 0,
    aboutMe: view.aboutMe,
    aboutMeHasPhoto: view.aboutMeHasPhoto,
    ...(view.username !== undefined ? { username: view.username } : {}),
    ...(view.shopCount !== undefined ? { shopCount: view.shopCount } : {}),
    ...(view.creditCount !== undefined ? { creditCount: view.creditCount } : {}),
    ...(view.fundingReviewedAt !== undefined ? { fundingReviewedAt: view.fundingReviewedAt } : {}),
    ...(view.fundingReviewedByName !== undefined
      ? { fundingReviewedByName: view.fundingReviewedByName }
      : {}),
    ...(view.staffTag !== undefined ? { staffTag: view.staffTag } : {}),
  });
}

/**
 * Client loader for `/view/[viewKey]`. Validates the key, fetches the public
 * profile, and renders `MemberProfileScreen` — the same card as `/profile`
 * and `/members/:id`. When a session exists and the payload has an id, a
 * member refetch replaces the card so hearts and trust match. If that refetch
 * fails, the public card stays. Activity comes from the member route after a
 * successful refetch, otherwise from the public view activity. The claim
 * banner stays under the card.
 *
 * @param props - Dynamic route `viewKey`.
 * @returns Loading, missing, error, or the shared profile card.
 */
export function ViewProfileLoader({ viewKey }: { viewKey: string }): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const [status, setStatus] = useState<'loading' | 'missing' | 'error' | 'ready'>(() =>
    VIEW_KEY_RE.test(viewKey) ? 'loading' : 'missing',
  );
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [usePublicLists, setUsePublicLists] = useState(true);
  const [received, setReceived] = useState<AccountActivity['receivedOverTime']>([]);
  const [donated, setDonated] = useState<AccountActivity['donatedOverTime']>([]);
  const [owed, setOwed] = useState<NonNullable<AccountActivity['owedOverTime']>>([]);
  const [credit, setCredit] = useState<NonNullable<AccountActivity['creditOverTime']>>([]);
  const [activityFailed, setActivityFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!VIEW_KEY_RE.test(viewKey)) {
      setStatus('missing');
      setProfile(null);
      setHasPasskey(false);
      setUsePublicLists(true);
      setReceived([]);
      setDonated([]);
      setOwed([]);
      setCredit([]);
      setActivityFailed(false);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setProfile(null);
    setHasPasskey(false);
    setUsePublicLists(true);
    setReceived([]);
    setDonated([]);
    setOwed([]);
    setCredit([]);
    setActivityFailed(false);

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
        let card = memberProfileFromView(next);
        let publicLists = true;
        let activitySession: string | null = null;
        if (session !== null && typeof next.id === 'string' && next.id !== '') {
          try {
            const member = await fetchMember(session, next.id);
            if (cancelled) {
              return;
            }
            if (member !== null) {
              card = member;
              publicLists = false;
              activitySession = session;
            }
          } catch {
            if (cancelled) {
              return;
            }
          }
        }
        setProfile(card);
        setHasPasskey(next.hasPasskey);
        setUsePublicLists(publicLists);
        setStatus('ready');
        setReceived([]);
        setDonated([]);
        setOwed([]);
        setCredit([]);
        setActivityFailed(false);

        try {
          const activity =
            activitySession !== null
              ? await fetchMemberActivity(activitySession, card.id)
              : await fetchViewActivity(viewKey);
          if (cancelled) {
            return;
          }
          setReceived(activity.receivedOverTime);
          setDonated(activity.donatedOverTime);
          setOwed(activity.owedOverTime ?? []);
          setCredit(activity.creditOverTime ?? []);
          setActivityFailed(false);
        } catch {
          if (cancelled) {
            return;
          }
          setReceived([]);
          setDonated([]);
          setOwed([]);
          setCredit([]);
          setActivityFailed(true);
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
  }, [viewKey, attempt, session]);

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

  return (
    <div className="flex flex-col items-center gap-4">
      <MemberProfileScreen
        profile={readyProfile}
        received={received}
        donated={donated}
        owed={owed}
        credit={credit}
        activityFailed={activityFailed}
        {...(usePublicLists ? { loadPublicList: (kind) => fetchViewForumList(viewKey, kind) } : {})}
        loadAboutPhoto={() => fetchViewAboutMePhoto(viewKey)}
      />
      <ViewProfileClaim viewKey={viewKey} hasPasskey={hasPasskey} />
    </div>
  );
}
