'use client';

import Link from 'next/link';
import { type ReactElement } from 'react';
import { FundingPausedCopy } from '@/components/FundingPausedCopy';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink } from '@/components/ui';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { grantApplicationsPaused } from '@/lib/grant-applications';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Grant section shown on `/grants`, not on the profile.
 *
 * Unverified (`basis`) members see that they are not verified and how in-person
 * verification works. Verified and above see funding status from `account.funding`
 * (missing or `null` is treated as `none`): while applications are paused,
 * paused copy for `none`/`rejected`; otherwise the daily-gift sentence, About
 * link, and Apply link to `/grants/apply`. Then open application, one-day
 * trial, or admitted with the participation sentence.
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
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {t('funding.heading')}
    </h1>
  );

  if (!roleAtLeast(account.role, 'verified')) {
    return (
      <div className="flex w-full flex-col items-stretch gap-3">
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
    const reviewerName = (funding.reviewedByName ?? '').trim();
    body = (
      <>
        <p className="text-center text-sm text-app-muted">{t('funding.admitted')}</p>
        <p className="text-center text-sm text-app-muted">
          {typeof admittedAt === 'number' && reviewerName !== ''
            ? t('funding.participatesSinceBy', {
                date: formatForumTimeFromMs(admittedAt, locale),
                name: reviewerName,
              })
            : admittedAt === null
              ? t('funding.participates')
              : t('funding.participatesSince', {
                  date: formatForumTimeFromMs(admittedAt, locale),
                })}
        </p>
      </>
    );
  } else {
    body = grantApplicationsPaused() ? (
      <div className="flex flex-col items-center gap-3 text-center">
        <FundingPausedCopy />
      </div>
    ) : (
      <>
        <p className="text-center text-sm text-app-muted">{t('funding.grace')}</p>
        <Link
          href="/about"
          className="text-center text-sm text-app-fg underline underline-offset-2"
        >
          {t('nav.about')}
        </Link>
        <ButtonLink href="/grants/apply" size="lg">
          {t('funding.apply')}
        </ButtonLink>
      </>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3">
      {heading}
      {body}
    </div>
  );
}
