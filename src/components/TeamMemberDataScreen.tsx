'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { TeamMemberEvents } from '@/components/TeamMemberEvents';
import { TeamMemberWallet } from '@/components/TeamMemberWallet';
import { Card, SegmentedControl } from '@/components/ui';
import { fetchMember } from '@/lib/api';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Tab of the member-data page. */
type MemberDataTab = 'wallet' | 'activity';

/** Props for {@link TeamMemberDataScreen}. */
export interface TeamMemberDataScreenProps {
  /** Member account id from the route. */
  accountId: string;
}

/**
 * Signed-in staff page of one member's data (`/moderate/members/{id}`).
 *
 * Moderators (and every higher role) see the heading, the member's name as a
 * link to `/members/{id}` (from the existing member profile,
 * {@link fetchMember}; left out while it loads or when it fails), and a
 * Wallet / Activity switch: {@link TeamMemberWallet} or
 * {@link TeamMemberEvents}. The api records each read in the access log.
 * Other signed-in visitors see the forbidden sentence and nothing is
 * fetched. Renders nothing without a session. The page chrome owns the
 * back; this screen renders none.
 *
 * @param props - See {@link TeamMemberDataScreenProps}.
 * @returns The member-data card, forbidden copy, or `null` without a session.
 */
export function TeamMemberDataScreen(props: TeamMemberDataScreenProps): ReactElement | null {
  const { accountId } = props;
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [tab, setTab] = useState<MemberDataTab>('wallet');
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setName(null);
    void fetchMember(session, accountId)
      .then((member) => {
        if (!cancelled && member !== null) {
          setName(member.name ?? t('moderate.unnamed'));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session, staff, accountId, t]);

  if (session === null) {
    return null;
  }

  const heading = (
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {t('team.search.heading')}
    </h1>
  );

  if (!staff) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <div className="flex w-full flex-col items-center gap-1">
        {heading}
        {name === null ? null : (
          <Link
            href={`/members/${encodeURIComponent(accountId)}`}
            aria-label={`${name}, ${t('team.member.profile')}`}
            className="text-center text-base font-medium text-app-fg underline underline-offset-2"
          >
            {name}
          </Link>
        )}
      </div>
      <SegmentedControl
        tone="neutral"
        ariaLabel={t('team.member.viewLabel')}
        value={tab}
        options={[
          { value: 'wallet', label: t('team.member.tabWallet') },
          { value: 'activity', label: t('team.member.tabActivity') },
        ]}
        onChange={setTab}
      />
      {tab === 'wallet' ? (
        <TeamMemberWallet session={session} accountId={accountId} />
      ) : (
        <TeamMemberEvents session={session} accountId={accountId} />
      )}
    </Card>
  );
}
