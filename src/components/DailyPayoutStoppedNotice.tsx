'use client';

import { type ReactElement } from 'react';
import { FundingPausedCopy } from '@/components/FundingPausedCopy';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink } from '@/components/ui';
import { grantApplicationStillOpen, grantApplicationsPaused } from '@/lib/grant-applications';
import { useWalletOpen } from '@/hooks/useWalletOpen';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Non-dismissible info banner when the owner's funding JSON has
 * `dailyPayoutStoppedNotice === true`. While applications are paused, shows
 * paused copy except for usernames in `GRANT_APPLICATION_STILL_OPEN_USERNAMES`,
 * who still see the Apply link. That link is not the apply walk. Otherwise
 * links to `/grants/apply`. Nothing shows while the account's wallet is not
 * open in this tab (`useWalletOpen`): that session counts as signed out.
 *
 * @returns The banner, or `null` when the flag is not strictly true or the wallet is not open.
 */
export function DailyPayoutStoppedNotice(): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const walletOpen = useWalletOpen();

  if (!walletOpen || account?.funding?.dailyPayoutStoppedNotice !== true) {
    return null;
  }

  const titleId = 'daily-payout-stopped-title';

  return (
    <div role="region" aria-labelledby={titleId} className="flex-none px-8 pb-2">
      <div className="flex flex-col gap-2 rounded-xl border border-app-border bg-app-bg p-3 text-app-fg">
        <h2 id={titleId} className="text-sm font-semibold">
          {t('funding.stoppedDaily.title')}
        </h2>
        {grantApplicationsPaused() && !grantApplicationStillOpen(account?.username) ? (
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
