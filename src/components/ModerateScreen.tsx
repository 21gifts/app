'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink, Card } from '@/components/ui';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in moderation hub of staff tools.
 *
 * Moderators see labeled Goals, Hidden notes, Open proposals, Moderators chat
 * group, Handbook, Show payout per person, Member data, and Access log. Goals
 * goes to `/grants/goals`.
 * The Open proposals control goes to
 * `/moderate/proposals` and shows `proposalCount` when greater than zero. The
 * Moderators chat group control goes to `/moderate/group` and shows a
 * staff-room unread count when greater than zero. Handbook goes to
 * `/moderate/handbook`. Show payout per person goes to `/moderate/payouts`.
 * Member data goes to `/moderate/members`. Access log goes to
 * `/moderate/audit`; the api serves that log to founders and initiators only,
 * and a moderator, who shares the initiator rank, sees why it is closed there.
 * Other signed-in visitors see a short forbidden message and no tools list.
 * Does not fetch hidden notes, proposals, gift stats, or the group thread;
 * unread for Open proposals and Moderators chat group comes from
 * {@link useUnreadCount}. Renders nothing without a session.
 *
 * @returns The moderation hub card, forbidden copy, or `null` without a session.
 */
export function ModerateScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const { moderationUnreadCount, proposalCount } = useUnreadCount(true, { writeBadge: false });
  const groupUnreadCount = moderationUnreadCount - proposalCount;

  if (session === null) {
    return null;
  }

  if (!staff) {
    return (
      <Card maxWidth="xl" surface={false}>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('moderate.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('moderate.heading')}
      </h1>
      <ul aria-label={t('moderate.toolsLabel')} className="flex w-full flex-col gap-3">
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/grants/goals" variant="secondary" size="lg">
            {t('funding.goals.link')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/hidden" variant="secondary" size="lg">
            {t('moderate.listLabel')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink
            href="/moderate/proposals"
            variant="secondary"
            size="lg"
            {...(proposalCount > 0
              ? {
                  'aria-label': t('moderate.proposals.unread', { count: String(proposalCount) }),
                }
              : {})}
          >
            {t('moderate.proposals.heading')}
            {proposalCount > 0 ? (
              <span className="font-semibold tabular-nums lining-nums">{proposalCount}</span>
            ) : null}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink
            href="/moderate/group"
            variant="secondary"
            size="lg"
            {...(groupUnreadCount > 0
              ? {
                  'aria-label': t('moderate.groupUnread', { count: String(groupUnreadCount) }),
                }
              : {})}
          >
            {t('moderate.groupLabel')}
            {groupUnreadCount > 0 ? (
              <span className="font-semibold tabular-nums lining-nums">{groupUnreadCount}</span>
            ) : null}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/handbook" variant="secondary" size="lg">
            {t('moderate.handbook.heading')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/payouts" variant="secondary" size="lg">
            {t('moderate.payouts.link')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/members" variant="secondary" size="lg">
            {t('moderate.memberData.link')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/audit" variant="secondary" size="lg">
            {t('moderate.audit.link')}
          </ButtonLink>
        </li>
      </ul>
    </Card>
  );
}
