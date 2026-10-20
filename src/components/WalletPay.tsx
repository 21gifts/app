'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { AddBitcoinButton } from '@/components/OpenReceive';
import { usePaySheetSent } from '@/components/PaySheet';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button } from '@/components/ui';
import { useWalletPay } from '@/hooks/useWalletPay';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';
import type { PayFlow } from '@/lib/wallet/payment-failure';

/** Props for {@link WalletPay}. */
export interface WalletPayProps {
  /** Request the api issued for the in-app wallet, or `null`/`undefined` when it issued none. */
  sparkInvoice: string | null | undefined;
  /** Payment request of the same invoice; the wallet pays it when there is no `sparkInvoice`. */
  pr: string;
  /** Whole sats the sheet shows for this invoice; the wallet pays only this amount. */
  amountSats: number;
  /**
   * Current spot rate for the fiat of the confirm label, of a fee above ₿0 and of the missing
   * amount, or `null`.
   */
  rateDay: FiatRateDay | null;
  /** Feature whose sheet this is: named on the report of a payment that did not go out. */
  flow: PayFlow;
  /**
   * True on the posting fee: paying also posts the note, so the confirm button
   * says **Pay ₿500 and post** instead of **Send**.
   */
  postsOnPay?: boolean;
  /**
   * Label of the confirm button instead of **Send**, built from the amount with
   * its fiat (`₿500 · $0.50`, bitcoin alone without a usable rate), e.g.
   * **Send ₿500 · $0.50** or **Lend ₿500 · $0.50**.
   */
  confirmLabel?: ((amount: string) => string) | undefined;
}

/**
 * Pay slot of the pay sheet (`PaySheet`). The member pays from the in-app wallet
 * only, which is open whenever the member is signed in. It shows the fee from
 * the prepare response only when it is above ₿0 (in-app payments quote ₿0, so
 * the row is usually absent), then one full-width primary button: the
 * `confirmLabel` (**Send ₿500 · $0.50**, **Lend ₿500 · $0.50**), **Pay ₿500 and
 * post** on the posting fee, or **Send**. While sending it says so; the
 * host's own long-poll closes the sheet on confirmation. Too little balance
 * shows an alert, how much is still missing (amount plus the known fee minus
 * the balance, with fiat), and a full-width **Add Bitcoin**, which closes the
 * sheet and opens the wallet's Receive view (`AddBitcoinButton`); no
 * address and no QR. Once the balance covers the
 * payment, the slot prepares again and shows the pay button.
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
  const amountPriced = satsToFiatAmount(amountSats, rateDay, fiat);
  const amountWithFiat =
    amountPriced === null
      ? formatBitcoin(amountSats, numberFormat)
      : `${formatBitcoin(amountSats, numberFormat)} · ${formatFiatDisplay(amountPriced, fiat, numberFormat)}`;
  const { view, sent, feeSats, missingSats, pay, retry } = useWalletPay(
    sparkInvoice,
    pr,
    amountSats,
    flow,
  );
  const reportSent = usePaySheetSent();
  // Only a send that went out lets the sheet show its success step when the host closes the
  // payment; one still pending keeps the sheet waiting for the wallet's answer.
  useEffect(() => {
    reportSent?.(sent);
  }, [reportSent, sent]);

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
            <Button type="button" variant="secondary" size="lg" onClick={retry}>
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
            <Button type="button" variant="primary" size="lg" onClick={pay}>
              {postsOnPay ? (
                <span className="text-center">
                  {t('wallet.payAndPost', { amount: formatBitcoin(amountSats, numberFormat) })}
                </span>
              ) : confirmLabel !== undefined ? (
                <span className="text-center">{confirmLabel(amountWithFiat)}</span>
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
            <AddBitcoinButton />
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

  // The states sit in the sheet's flex column with its gap; the buttons take its full width.
  return <div className="flex w-full flex-col items-stretch gap-3">{body}</div>;
}
