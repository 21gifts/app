'use client';

import { Loader2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button } from '@/components/ui';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
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
  /** In `error`, true when this phone or browser cannot hold the wallet (no PRF). */
  prfUnsupported?: boolean;
}

/**
 * Wallet balance block for locked, connecting, ready, and error states. The
 * ready balance is a large ₿ figure; when the default fiat has a usable rate,
 * tapping it swaps which of ₿ and fiat is the large figure. An error from a
 * passkey without PRF output says that this phone or browser cannot hold a
 * 21.gifts wallet instead of the generic open error.
 *
 * @param props - Wallet state and labeled control callbacks.
 * @returns The balance region, or `null` while the wallet feature is disabled.
 */
export function WalletBalance({
  status,
  balanceSats,
  onUnlock,
  onRetry,
  prfUnsupported = false,
}: WalletBalanceProps): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useLatestRateDay(status === 'ready');
  const [fiatFirst, setFiatFirst] = useState(false);

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
  } else if (status === 'ready' && balanceSats === null) {
    body = null;
  } else if (status === 'ready' && balanceSats !== null) {
    const fiatAmount = satsToFiatAmount(balanceSats, rateDay, fiat);
    const bitcoinText = formatBitcoin(balanceSats, numberFormat);
    const largeClass =
      'text-center text-5xl font-semibold tracking-tight tabular-nums lining-nums text-app-fg sm:text-6xl';
    if (fiatAmount === null) {
      body = <p className={largeClass}>{bitcoinText}</p>;
    } else {
      const fiatText = formatFiatDisplay(fiatAmount, fiat, numberFormat);
      body = (
        <button
          type="button"
          onClick={() => {
            setFiatFirst((value) => !value);
          }}
          className="flex flex-col items-center gap-2 rounded-3xl px-4 py-2 transition hover:bg-app-hover"
        >
          <span className={largeClass}>{fiatFirst ? fiatText : bitcoinText}</span>
          <span className="text-center text-base tabular-nums lining-nums text-app-muted">
            {fiatFirst ? bitcoinText : fiatText}
          </span>
        </button>
      );
    }
  } else {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t(prfUnsupported ? 'wallet.prfUnsupported' : 'wallet.balanceError')}
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
