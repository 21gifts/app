'use client';

import { Loader2 } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { Swap } from '@/components/Motion';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { WalletOwnAddress } from '@/components/WalletOwnAddress';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button } from '@/components/ui';
import { useWalletPay } from '@/hooks/useWalletPay';
import { giftsLightningAddress } from '@/lib/gifts-address';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';
import type { PayFlow } from '@/lib/wallet/payment-failure';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link WalletPay}. */
export interface WalletPayProps {
  /** Request the api issued for the in-app wallet, or `null`/`undefined` when it issued none. */
  sparkInvoice: string | null | undefined;
  /** Payment request of the same invoice; the wallet pays it when there is no `sparkInvoice`. */
  pr: string;
  /** Whole sats the sheet shows for this invoice; the wallet pays only this amount. */
  amountSats: number;
  /** Current spot rate for the fiat line of a fee above ₿0 and of the missing amount, or `null`. */
  rateDay: FiatRateDay | null;
  /** Feature whose sheet this is: named on the report of a payment that did not go out. */
  flow: PayFlow;
  /**
   * True on the posting fee: paying also posts the note, so the confirm button
   * says **Pay {amount} and post** instead of **Send**.
   */
  postsOnPay?: boolean;
  /** Label of the confirm button instead of **Send**, e.g. **Lend** with the amount on a loan. */
  confirmLabel?: string | undefined;
}

/**
 * Pay slot of an invoice pay sheet. The member pays from the in-app wallet
 * only, which is open whenever the member is signed in. It shows the fee from
 * the prepare response when it is above ₿0 (in-app payments quote ₿0, so the
 * row is usually absent), then **Send**; on the posting fee that button says
 * **Pay {amount} and post**, without a fiat suffix. While and
 * after sending it says so; the sheet's own long-poll closes it on
 * confirmation. Too little balance shows an alert, how much is still missing
 * (amount plus the known fee minus the balance, with fiat), and the member's
 * own address and QR when their username gives one; once the balance covers
 * the payment, the slot prepares again and shows the pay button (with the fee
 * row only for a fee above ₿0).
 * While the one-time wallet setup is still due, the progress line shows until
 * it is done, and a setup that gave up shows the inline setup note with
 * **Try again**. Without a wallet the member can use here it says so, and a
 * failed prepare offers **Try again**. It never shows an invoice QR or hands
 * the payment to another wallet. A payment that did not go out is reported
 * under `flow`.
 *
 * @param props - Requests, shown amount, and spot rate.
 * @returns The pay slot.
 */
export function WalletPay({
  sparkInvoice,
  pr,
  amountSats,
  rateDay,
  flow,
  postsOnPay = false,
  confirmLabel,
}: WalletPayProps): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const { view, feeSats, missingSats, pay, retry } = useWalletPay(
    sparkInvoice,
    pr,
    amountSats,
    flow,
  );
  const username = useAuthStore((state) => state.account?.username ?? null);
  const hasAddress = giftsLightningAddress(username) !== null;

  const body = ((): ReactNode => {
    switch (view) {
      case 'unavailable':
        return (
          <p role="status" className="px-6 text-center text-sm text-app-muted">
            {t('wallet.payUnavailable')}
          </p>
        );
      case 'failed':
        return (
          <>
            <p role="alert" className="px-6 text-center text-sm text-app-danger">
              {t('wallet.payFailed')}
            </p>
            <Button type="button" variant="secondary" onClick={retry}>
              {t('wallet.payRetry')}
            </Button>
          </>
        );
      case 'setupFailed':
        return <WalletSetupNote />;
      case 'preparing':
      case 'paying':
        return (
          <div className="flex flex-col items-center gap-2">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-app-subtle" />
            <p role="status" className="text-center text-sm text-app-muted">
              {t(view === 'preparing' ? 'wallet.payPreparing' : 'wallet.paying')}
            </p>
          </div>
        );
      case 'confirm': {
        /* v8 ignore next -- confirm is reached only after the fee is set */
        const fee = feeSats ?? 0;
        return (
          <>
            {fee > 0 ? (
              <p className="text-center text-xs tabular-nums lining-nums text-app-muted">
                {t('wallet.payFee', { amount: formatBitcoin(fee, numberFormat) })}
                {preferredFiatSuffix(fee, rateDay, fiat, numberFormat)}
              </p>
            ) : null}
            <Button type="button" variant="primary" onClick={pay}>
              {postsOnPay ? (
                <span className="text-center">
                  {t('wallet.payAndPost', { amount: formatBitcoin(amountSats, numberFormat) })}
                </span>
              ) : confirmLabel !== undefined ? (
                <span className="text-center">{confirmLabel}</span>
              ) : (
                t('wallet.payFromWallet')
              )}
            </Button>
          </>
        );
      }
      case 'insufficient':
        return (
          <>
            <p role="alert" className="text-center text-sm text-app-danger">
              {t('wallet.payInsufficient')}
            </p>
            {missingSats === null ? null : (
              <p className="text-center text-sm tabular-nums lining-nums text-app-fg">
                {t('wallet.payMissing', { amount: formatBitcoin(missingSats, numberFormat) })}
                {preferredFiatSuffix(missingSats, rateDay, fiat, numberFormat)}
              </p>
            )}
            {hasAddress && username !== null ? <WalletOwnAddress username={username} /> : null}
          </>
        );
      default:
        return (
          <p role="status" className="px-6 text-center text-sm text-app-muted">
            {t('wallet.payUnconfirmed')}
          </p>
        );
    }
  })();

  // The states sit in the sheet's flex column; the box keeps that column and its gap. Preparing
  // and paying are one view, so only their line changes.
  return (
    <Swap
      viewKey={view === 'paying' ? 'preparing' : view}
      className="flex w-full flex-col items-center gap-3"
    >
      {body}
    </Swap>
  );
}
