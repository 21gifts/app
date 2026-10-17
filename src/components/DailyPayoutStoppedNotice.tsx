'use client';

import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink } from '@/components/ui';
import { useWalletOpen } from '@/hooks/useWalletOpen';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Non-dismissible info banner when the owner's funding JSON has
 * `dailyPayoutStoppedNotice === true`. Shows why the payout stopped and links
 * to `/grants/apply` (applications are open). Nothing shows while the account's wallet is not
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
        <p className="text-sm text-app-muted">{t('funding.stoppedDaily.body')}</p>
        <ButtonLink href="/grants/apply" size="lg">
          {t('funding.apply')}
        </ButtonLink>
      </div>
    </div>
  );
}
