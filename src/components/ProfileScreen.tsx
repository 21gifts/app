'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { fetchMember, fetchMemberActivity } from '@/lib/api';
import type { Account, AccountActivity, MemberProfile } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { returnToView } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Member card drawn from the signed-in account until `fetchMember` returns.
 * Counts stay at zero on that first paint. The staff label and the funding
 * admission stay on this card when the fetch has not arrived or has failed.
 * The fetched card replaces it.
 *
 * @param account - Signed-in account.
 * @returns A {@link MemberProfile} for the same id.
 */
function ownerPreview(account: Account): MemberProfile {
  const username = account.username;
  const funding = account.funding ?? null;
  const fundingMarks =
    funding !== null && typeof funding.admittedAt === 'number'
      ? {
          fundingReviewedAt: funding.admittedAt,
          fundingReviewedByName: funding.reviewedByName,
        }
      : {};
  return {
    id: account.id,
    name: account.name,
    location: account.location,
    role: account.role,
    lightningAddress: account.lightningAddressVerified ? account.lightningAddress : null,
    createdAt: new Date(account.createdAt).toISOString(),
    profileMessage: null,
    postCount: 0,
    replyCount: 0,
    aboutMe: account.aboutMe,
    aboutMeHasPhoto: account.aboutMeHasPhoto === true,
    ...(typeof username === 'string' ? { username } : {}),
    ...(account.staffTag === 'software_developer' ? { staffTag: account.staffTag } : {}),
    ...fundingMarks,
    trust: {
      verifiedBy: null,
      proposedBy: null,
      confirmedBy: null,
      appointedBy: null,
    },
  };
}

/**
 * Signed-in profile. One `MemberProfileScreen`, the same card a visitor sees
 * on `/members/:id` and on the share link. Owner edits appear because the
 * account id matches. The copy button receives this account's view key, so
 * it writes `/view/<viewKey>`. Charts use `fetchMemberActivity`, the same series a
 * visitor loads. Preferences live on `/settings`.
 *
 * The card paints from the account immediately, so the chart is never swapped
 * for `forum.loading`. A fetched card whose id is not this account is ignored,
 * including while the next fetch is in flight and after it fails. Empty gift
 * activity is `profile.chartEmpty`. A failed activity fetch shows
 * `profile.chartError` on the gift chart and
 * `profile.loanChartError` on the loan chart. An empty loan series renders
 * nothing.
 *
 * @returns The identity card, or a title-only shell when no account is loaded.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const accountId = account?.id;
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [memberStatus, setMemberStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [memberAttempt, setMemberAttempt] = useState(0);
  const [received, setReceived] = useState<AccountActivity['receivedOverTime']>([]);
  const [donated, setDonated] = useState<AccountActivity['donatedOverTime']>([]);
  const [owed, setOwed] = useState<NonNullable<AccountActivity['owedOverTime']>>([]);
  const [credit, setCredit] = useState<NonNullable<AccountActivity['creditOverTime']>>([]);
  const [activityFailed, setActivityFailed] = useState(false);
  const preview = useMemo(() => (account === null ? null : ownerPreview(account)), [account]);

  useEffect(() => {
    if (session === null || accountId === undefined) {
      return;
    }
    let cancelled = false;
    setMemberStatus('loading');
    setReceived([]);
    setDonated([]);
    setOwed([]);
    setCredit([]);
    setActivityFailed(false);

    void (async () => {
      try {
        const next = await fetchMember(session, accountId);
        if (cancelled) {
          return;
        }
        if (next === null) {
          setMemberStatus('error');
          return;
        }
        setMember(next);
        setMemberStatus('ready');
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof MissingRequirementsError) {
          returnToView('/setup/rules', router);
          return;
        }
        setMemberStatus('error');
      }
    })();

    void (async () => {
      try {
        const activity = await fetchMemberActivity(session, accountId);
        if (cancelled) {
          return;
        }
        setReceived(activity.receivedOverTime);
        setDonated(activity.donatedOverTime);
        setOwed(activity.owedOverTime ?? []);
        setCredit(activity.creditOverTime ?? []);
        setActivityFailed(false);
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof MissingRequirementsError) {
          returnToView('/setup/rules', router);
          return;
        }
        setReceived([]);
        setDonated([]);
        setOwed([]);
        setCredit([]);
        setActivityFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    /* returnToView(…, router) is used on 409; next/navigation's identity is not stable */
  }, [session, accountId, memberAttempt]);

  // preview is null only when account is null. One branch covers the title-only shell.
  if (account === null) {
    return (
      <Card surface={false}>
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('profile.title')}
        </h1>
      </Card>
    );
  }

  const shown = member !== null && member.id === account.id ? member : (preview as MemberProfile);

  return (
    <>
      <MemberProfileScreen
        profile={shown}
        received={received}
        donated={donated}
        owed={owed}
        credit={credit}
        activityFailed={activityFailed}
        shareViewKey={account.viewKey}
      />
      {memberStatus === 'error' ? (
        <div className="flex flex-col items-center gap-4">
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.error')}
          </p>
          <Button
            type="button"
            onClick={() => {
              setMemberAttempt((n) => n + 1);
            }}
          >
            {t('view.retry')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
