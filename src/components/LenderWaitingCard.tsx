'use client';

import { useEffect, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { ButtonLink } from '@/components/ui';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import { formatBitcoin } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Card on the welcome screen for a lender who is owed repayments but cannot
 * receive them yet (`lenderWaiting` of `GET /me/loans`): how many are waiting,
 * their sum in bitcoin with the current spot when the api could price it, and
 * **Open your wallet** to `/wallet`, the same action as the wallet requirement.
 * When the account's wallet becomes verified while the card shows, the shared
 * loans body is read again, so the card leaves once the api counts nothing.
 *
 * @returns The card, or `null` while unavailable or when nothing waits.
 */
export function LenderWaitingCard(): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const { loans, reload } = useMyLoans();
  const walletVerified = useAuthStore((state) => state.account?.sparkWalletVerified === true);
  const waiting = loans?.lenderWaiting;
  const shown = waiting !== undefined && waiting.shares > 0;
  useEffect(() => {
    if (walletVerified && shown) {
      void reload();
    }
  }, [walletVerified, shown, reload]);
  if (!shown) {
    return null;
  }
  const title =
    waiting.shares === 1
      ? t('loans.lenderWaitingOne')
      : t('loans.lenderWaitingMany', { count: waiting.shares });
  return (
    <section
      aria-label={title}
      className="mt-4 w-full rounded-2xl border border-app-border bg-app-card-muted p-4"
    >
      <h2 className="text-sm font-semibold text-app-fg">{title}</h2>
      {waiting.sats === null ? null : (
        <p className="mt-1 text-base font-semibold tabular-nums lining-nums text-app-fg">
          {formatBitcoin(waiting.sats, numberFormat)}
          {preferredFiatSuffix(waiting.sats, rateDay, fiat, numberFormat)}
        </p>
      )}
      <ButtonLink href="/wallet" size="sm" className="mt-3">
        {t('requirements.walletOpen')}
      </ButtonLink>
    </section>
  );
}
