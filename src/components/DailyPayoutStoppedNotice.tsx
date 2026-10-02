'use client';

import { type ReactElement } from 'react';
import { FundingPausedCopy } from '@/components/FundingPausedCopy';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink } from '@/components/ui';
import { grantApplicationsPaused } from '@/lib/grant-applications';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Non-dismissible info banner when the owner's funding JSON has
 * `dailyPayoutStoppedNotice === true`. While applications are paused, shows
 * paused copy. Otherwise links to `/grants/apply`.
 *
 * @returns The banner, or `null` when the flag is not strictly true.
 */
export function DailyPayoutStoppedNotice(): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);

  if (account?.funding?.dailyPayoutStoppedNotice !== true) {
    return null;
  }

  const titleId = 'daily-payout-stopped-title';

  return (
    <div role="region" aria-labelledby={titleId} className="flex-none px-8 pb-2">
      <div className="flex flex-col gap-2 rounded-xl border border-app-border bg-app-bg p-3 text-app-fg">
        <h2 id={titleId} className="text-sm font-semibold">
          {t('funding.stoppedDaily.title')}
        </h2>
        {grantApplicationsPaused() ? (
          <FundingPausedCopy />
        ) : (
          <>
            <p className="text-sm text-app-muted">{t('funding.stoppedDaily.body')}</p>
            <ButtonLink href="/grants/apply" size="lg">
              {t('funding.apply')}
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
