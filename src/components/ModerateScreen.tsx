'use client';

import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink, Card } from '@/components/ui';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in moderation hub of staff tools.
 *
 * Moderators see hub copy and labeled Hidden notes, Open
 * proposals, and Moderators tools. The Moderators control goes to
 * `/moderate/group`. Other signed-in visitors see a short forbidden message
 * and no tools list. Does not fetch hidden notes, proposals, or the group
 * thread. Renders nothing without a session.
 *
 * @returns The moderation hub card, forbidden copy, or `null` without a session.
 */
export function ModerateScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');

  if (session === null) {
    return null;
  }

  if (!staff) {
    return (
      <Card maxWidth="xl">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('moderate.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  return (
    <Card maxWidth="xl">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('moderate.heading')}
      </h1>
      <p className="text-center text-sm text-app-muted">{t('moderate.hubLead')}</p>
      <ul aria-label={t('moderate.toolsLabel')} className="flex w-full flex-col gap-3">
        <li className="flex w-full flex-col items-center gap-3">
          <p className="text-center text-sm text-app-muted">{t('moderate.lead')}</p>
          <ButtonLink href="/moderate/hidden" variant="secondary" size="lg">
            {t('moderate.listLabel')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <ButtonLink href="/moderate/proposals" variant="secondary" size="lg">
            {t('moderate.proposals.heading')}
          </ButtonLink>
        </li>
        <li className="flex w-full flex-col items-center gap-3">
          <p className="text-center text-sm text-app-muted">{t('moderate.groupLead')}</p>
          <ButtonLink href="/moderate/group" variant="secondary" size="lg">
            {t('moderate.groupLabel')}
          </ButtonLink>
        </li>
      </ul>
    </Card>
  );
}
