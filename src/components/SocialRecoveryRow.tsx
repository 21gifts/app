'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The Social Recovery row of the settings Wallet section (id
 * `social-recovery`): the overline **Social Recovery**, a status line, and the
 * links to its two pages. Without a verified wallet the status says it becomes
 * available once the wallet is connected, and **Secure my account** is
 * hidden; otherwise it says whether 21.gifts holds this wallet's share
 * (`socialRecoverySetUp`), and **Secure my account** opens
 * `/settings/social-recovery` (primary while not set up, secondary once it
 * is). **Shares I keep for others** always opens `/settings/held-shares`,
 * where a member keeps the shares other members gave them.
 *
 * @returns The row, or `null` before the account has loaded.
 */
export function SocialRecoveryRow(): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  if (account === null) {
    return null;
  }
  const verified = account.sparkWalletVerified === true;
  const setUp = verified && account.socialRecoverySetUp === true;
  const status = !verified
    ? t('socialRecovery.statusNoWallet')
    : setUp
      ? t('socialRecovery.statusOn')
      : t('socialRecovery.statusOff');
  return (
    <div
      id="social-recovery"
      className="flex w-full scroll-mt-4 flex-col items-stretch gap-3 border-t border-app-border pt-6"
    >
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('socialRecovery.heading')}
      </p>
      <p className="text-center text-sm text-app-muted">{status}</p>
      {verified ? (
        <ButtonLink
          href="/settings/social-recovery"
          variant={setUp ? 'secondary' : 'primary'}
          size="lg"
        >
          {t('socialRecovery.secure')}
        </ButtonLink>
      ) : null}
      <ButtonLink href="/settings/held-shares" variant="secondary" size="lg">
        {t('socialRecovery.heldLink')}
      </ButtonLink>
    </div>
  );
}
