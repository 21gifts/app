'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { QrCode } from '@/components/QrCode';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button } from '@/components/ui';
import { useWalletPay } from '@/hooks/useWalletPay';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link WalletPay}. */
export interface WalletPayProps {
  /** Request the api issued for the in-app wallet, or `null`/`undefined` when it issued none. */
  sparkInvoice: string | null | undefined;
  /** Payment request of the same invoice; the wallet pays it when there is no `sparkInvoice`. */
  pr: string;
  /** Whole sats the sheet shows for this invoice; the wallet pays only this amount. */
  amountSats: number;
  /** Current spot rate for the fee's fiat line, or `null`. */
  rateDay: FiatRateDay | null;
  /**
   * True on the posting fee: paying also posts the note, so the confirm button
   * says **Pay {amount} and post** instead of **Send**.
   */
  postsOnPay?: boolean;
}

/**
 * The member's own 21.gifts address and its Open CryptoPay QR, shown when the
 * wallet balance is too low so Bitcoin can be added. The same address and QR
 * as `/wallet`, so it is shown on a smartphone too. It shrinks to fit a narrow
 * card (the reaction pay page on a phone) and never grows past its usual size.
 *
 * @param props - The member's username, which gives a 21.gifts address.
 * @returns The address block, or `null` before the page host is known.
 */
function OwnAddress({ username }: { username: string }): ReactElement | null {
  const { t } = useTranslations();
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => {
    setHost(window.location.hostname);
  }, []);
  if (host === null) {
    return null;
  }
  const address = giftsLightningAddress(username, host);
  const qr = openCryptoPayQrValue(username, host);
  /* v8 ignore next 3 -- WalletPay renders this only when the username gives an address */
  if (address === null || qr === null) {
    return null;
  }
  return (
    <>
      <p className="text-center text-sm text-app-muted">{t('wallet.payAddFunds')}</p>
      <p className="min-w-0 max-w-full truncate text-center font-mono text-sm text-app-fg">
        {address}
      </p>
      <div className="w-full max-w-[266px] [&_svg]:h-auto [&_svg]:w-full">
        <QrCode value={qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
      </div>
    </>
  );
}

/**
 * Pay slot of an invoice pay sheet. The member pays from the in-app wallet
 * only, which is open whenever the member is signed in. It shows the fee from
 * the prepare response, then **Send**;
 * on the posting fee that button says **Pay {amount} and post**. While and
 * after sending it says so; the sheet's own long-poll closes it on
 * confirmation. Too little balance shows an alert, how much is still missing
 * (amount plus the known fee minus the balance, with fiat), and the member's
 * own address and QR when their username gives one; once the balance covers
 * the payment, the slot prepares again and shows the fee and the pay button.
 * While the one-time wallet setup is still due, the progress line shows until
 * it is done, and a setup that gave up shows the inline setup note with
 * **Try again**. Without a wallet the member can use here it says so, and a
 * failed prepare offers **Try again**. It never shows an invoice QR or hands
 * the payment to another wallet.
 *
 * @param props - Requests, shown amount, and spot rate.
 * @returns The pay slot.
 */
export function WalletPay({
  sparkInvoice,
  pr,
  amountSats,
  rateDay,
  postsOnPay = false,
}: WalletPayProps): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const { view, feeSats, missingSats, pay, retry } = useWalletPay(sparkInvoice, pr, amountSats);
  const username = useAuthStore((state) => state.account?.username ?? null);
  const hasAddress = giftsLightningAddress(username) !== null;

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
          <p className="text-center text-xs tabular-nums lining-nums text-app-muted">
            {t('wallet.payFee', { amount: formatBitcoin(fee, numberFormat) })}
            {preferredFiatSuffix(fee, rateDay, fiat, numberFormat)}
          </p>
          <Button type="button" variant="primary" onClick={pay}>
            {postsOnPay ? (
              <span className="text-center">
                {t('wallet.payAndPost', { amount: formatBitcoin(amountSats, numberFormat) })}
                {preferredFiatSuffix(amountSats, rateDay, fiat, numberFormat)}
              </span>
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
          {hasAddress && username !== null ? <OwnAddress username={username} /> : null}
        </>
      );
    default:
      return (
        <p role="status" className="px-6 text-center text-sm text-app-muted">
          {t('wallet.payUnconfirmed')}
        </p>
      );
  }
}
