'use client';

import Link from 'next/link';
import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink } from '@/components/ui';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Owner profile section for verification and the 21 gifts grant.
 *
 * Unverified (`basis`) members see that they are not verified and how in-person
 * verification works (a moderator who personally knows them and has met them
 * in the real world confirms them on the member page). No apply button.
 * Verified and above see funding status from `account.funding` (missing or
 * `null` is treated as `none`): grace copy, About link, and Apply link to
 * `/profile/apply` for `none`/`rejected` (no denial sentence and no conviction
 * titles), open application, one-day trial, or admitted with the participation sentence.
 *
 * @returns The grant section, or `null` without a session or account.
 */
export function FundingStatusCard(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);

  if (session === null || account === null) {
    return null;
  }

  const heading = (
    <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
      {t('funding.heading')}
    </p>
  );

  if (!roleAtLeast(account.role, 'verified')) {
    return (
      <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
        {heading}
        <p className="text-center text-sm text-app-muted">{t('funding.notVerified')}</p>
        <p className="text-center text-sm text-app-muted">{t('funding.verifyHow')}</p>
      </div>
    );
  }

  const funding = account.funding ?? {
    status: 'none' as const,
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  };

  let body: ReactElement;
  if (funding.status === 'pending') {
    body = <p className="text-center text-sm text-app-muted">{t('funding.pending')}</p>;
  } else if (funding.status === 'trial') {
    body = <p className="text-center text-sm text-app-muted">{t('funding.trial')}</p>;
  } else if (funding.status === 'admitted') {
    const admittedAt = funding.admittedAt;
    body = (
      <>
        <p className="text-center text-sm text-app-muted">{t('funding.admitted')}</p>
        <p className="text-center text-sm text-app-muted">
          {admittedAt === null
            ? t('funding.participates')
            : t('funding.participatesSince', {
                date: formatForumTimeFromMs(admittedAt, locale),
              })}
        </p>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-center text-sm text-app-muted">{t('funding.grace')}</p>
        <Link
          href="/about"
          className="text-center text-sm text-app-fg underline underline-offset-2"
        >
          {t('nav.about')}
        </Link>
        <ButtonLink href="/profile/apply" size="lg">
          {t('funding.apply')}
        </ButtonLink>
      </>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      {heading}
      {body}
    </div>
  );
}
