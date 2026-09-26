'use client';

import type { ReactElement } from 'react';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink, Card } from '@/components/ui';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in grants page: the owner grant card, plus the staff queue for moderators.
 *
 * Renders nothing without a session. The applications link is only for
 * `roleAtLeast(role, 'moderator')`.
 *
 * @returns The grants card, or `null` without a session.
 */
export function GrantsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  if (session === null) {
    return null;
  }
  return (
    <Card surface={false}>
      <FundingStatusCard />
      {roleAtLeast(account?.role, 'moderator') ? (
        <ButtonLink href="/grants/applications" variant="secondary" size="lg">
          {t('funding.applications.heading')}
        </ButtonLink>
      ) : null}
    </Card>
  );
}
