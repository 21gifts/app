'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { postFundingApply } from '@/lib/api';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Convictions titles plus an About link, used as apply conditions.
 *
 * @returns The conditions copy, three titles, and `/about` link.
 */
function ConvictionsConditions(): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <p className="text-center text-sm text-app-muted">{t('funding.conditions')}</p>
      <ul className="flex w-full flex-col gap-1">
        <li className="text-center text-sm text-app-fg">{t('about.conv1Title')}</li>
        <li className="text-center text-sm text-app-fg">{t('about.conv2Title')}</li>
        <li className="text-center text-sm text-app-fg">{t('about.conv3Title')}</li>
      </ul>
      <Link href="/about" className="text-center text-sm text-app-fg underline underline-offset-2">
        {t('nav.about')}
      </Link>
    </>
  );
}

/**
 * Owner profile section for verification and the 21 gifts grant.
 *
 * Unverified (`basis`) members see that they are not verified and how in-person
 * verification works (a moderator who personally knows them and has met them
 * in the real world confirms them on the member page). No apply button.
 * Verified and above see funding status from `account.funding` (missing or
 * `null` is treated as `none`): not admitted + apply for `none`/`rejected`,
 * open application, one-day trial, or admitted with a reviewed-by date.
 *
 * @returns The grant section, or `null` without a session or account.
 */
export function FundingStatusCard(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [applying, setApplying] = useState(false);
  const [applyFailed, setApplyFailed] = useState(false);

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

  const apply = (): void => {
    /* v8 ignore next 3 — the action button is disabled while busy */
    if (applying) {
      return;
    }
    setApplying(true);
    setApplyFailed(false);
    void (async () => {
      try {
        const next = await postFundingApply(session);
        const current = useAuthStore.getState();
        if (current.session !== session || current.account === null) {
          return;
        }
        setAccount({ ...current.account, funding: next });
      } catch {
        setApplyFailed(true);
      } finally {
        setApplying(false);
      }
    })();
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
            ? t('funding.reviewedBy')
            : t('funding.reviewedOn', { date: formatForumTimeFromMs(admittedAt, locale) })}
        </p>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-center text-sm text-app-muted">{t('funding.notAdmitted')}</p>
        <p className="text-center text-sm text-app-muted">{t('funding.grace')}</p>
        <ConvictionsConditions />
        {applyFailed ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('funding.applyError')}
          </p>
        ) : null}
        <Button
          type="button"
          size="lg"
          disabled={applying}
          icon={
            applying ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined
          }
          onClick={apply}
        >
          {t('funding.apply')}
        </Button>
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
