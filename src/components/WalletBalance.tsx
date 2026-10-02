'use client';

import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { Button } from '@/components/ui';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import { formatBitcoin } from '@/lib/stats-money';
import type { WalletStatus } from '@/stores/wallet-store';

/** Props for {@link WalletBalance}. */
export interface WalletBalanceProps {
  /** Wallet state to render. */
  status: WalletStatus;
  /** Current whole-sat balance, or `null` before it is available. */
  balanceSats: number | null;
  /** Called by the labeled unlock control. */
  onUnlock: () => void;
  /** Called by the labeled retry control. */
  onRetry: () => void;
}

/**
 * Wallet balance block for locked, connecting, ready, and error states.
 *
 * @param props - Wallet state and labeled control callbacks.
 * @returns The balance region, or `null` while the wallet feature is disabled.
 */
export function WalletBalance({
  status,
  balanceSats,
  onUnlock,
  onRetry,
}: WalletBalanceProps): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useLatestRateDay(status === 'ready');

  if (status === 'disabled') {
    return null;
  }

  let body: ReactElement | null;
  if (status === 'locked') {
    body = (
      <>
        <p className="text-center text-sm text-app-muted">{t('wallet.locked')}</p>
        <Button variant="primary" onClick={onUnlock}>
          {t('wallet.unlock')}
        </Button>
      </>
    );
  } else if (status === 'connecting') {
    body = (
      <>
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />
        <p role="status" className="text-sm text-app-muted">
          {t('wallet.connecting')}
        </p>
      </>
    );
  } else if (status === 'ready') {
    body =
      balanceSats === null ? null : (
        <p className="text-center text-2xl font-semibold tabular-nums lining-nums text-app-fg">
          <span>{formatBitcoin(balanceSats, numberFormat)}</span>
          {preferredFiatSuffix(balanceSats, rateDay, fiat, numberFormat)}
        </p>
      );
  } else {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('wallet.balanceError')}
        </p>
        <Button onClick={onRetry}>{t('login.retry')}</Button>
      </>
    );
  }

  return (
    <section aria-label={t('wallet.balanceHeading')} className="flex flex-col items-center gap-3">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('wallet.balanceHeading')}
      </p>
      {body}
    </section>
  );
}
