'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, ButtonLink, Card } from '@/components/ui';
import { fetchFundingApplications } from '@/lib/api';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in grants page: the owner grant card, plus the staff queue for moderators.
 *
 * Renders nothing without a session. Moderators and founders see how many open
 * grant applications exist. When the count is greater than zero, a secondary
 * link to `/grants/applications` shows that count. When the count is zero, that
 * control is the empty sentence as plain text. Members below moderator never
 * see it and never trigger the fetch.
 *
 * @returns The grants card, or `null` without a session.
 */
export function GrantsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = session !== null && roleAtLeast(account?.role, 'moderator');
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [applicationsError, setApplicationsError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setApplicationsError(false);
    void (async () => {
      try {
        const next = await fetchFundingApplications(session);
        if (cancelled) {
          return;
        }
        setOpenCount(next.length);
      } catch {
        if (cancelled) {
          return;
        }
        setOpenCount(null);
        setApplicationsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, attempt]);

  if (session === null) {
    return null;
  }

  let queue: ReactElement | null = null;
  if (staff) {
    if (applicationsError) {
      queue = (
        <>
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('funding.applications.error')}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAttempt((n) => n + 1);
            }}
          >
            {t('moderate.retry')}
          </Button>
        </>
      );
    } else if (openCount === null) {
      queue = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
    } else if (openCount === 0) {
      queue = (
        <p className="text-center text-sm text-app-muted">{t('funding.applications.empty')}</p>
      );
    } else {
      queue = (
        <ButtonLink href="/grants/applications" variant="secondary" size="lg">
          {t('funding.applications.openCount', { count: openCount })}
        </ButtonLink>
      );
    }
  }

  return (
    <Card surface={false}>
      <FundingStatusCard />
      {queue}
    </Card>
  );
}
