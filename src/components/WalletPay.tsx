'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { QrCode } from '@/components/QrCode';
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
  /** Whole sats the sheet shows for this invoice; the wallet pays only this amount. */
  amountSats: number;
  /**
   * The existing desktop invoice QR plus Wallet of Satoshi button (smartphone:
   * button only), shown when the in-app path is not used, and under the
   * low-balance alert of a member without a 21.gifts address.
   */
  fallback: ReactNode;
  /** Latest gift-day totals for the fee's fiat line, or `null`. */
  rateDay: FiatRateDay | null;
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
 * Pay slot of an invoice pay sheet. With a `sparkInvoice` and a usable in-app
 * wallet it pays from the wallet: unlock when needed, the fee from the prepare
 * response, then **Pay from wallet**. While and after sending it says so; the
 * sheet's own long-poll closes it on confirmation. Too little balance shows an
 * alert with the member's own address and QR, or with `fallback` when the
 * member's username gives no address. Otherwise it renders `fallback` unchanged.
 *
 * @param props - Request, shown amount, fallback, and rate day.
 * @returns The pay slot.
 */
export function WalletPay({
  sparkInvoice,
  amountSats,
  fallback,
  rateDay,
}: WalletPayProps): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const { view, feeSats, unlock, pay } = useWalletPay(sparkInvoice, amountSats);
  const username = useAuthStore((state) => state.account?.username ?? null);
  const hasAddress = giftsLightningAddress(username) !== null;

  switch (view) {
    case 'fallback':
      return <>{fallback}</>;
    case 'unlock':
      return (
        <>
          <p className="px-6 text-center text-sm text-app-muted">{t('wallet.payUnlockHint')}</p>
          <Button type="button" variant="primary" onClick={unlock}>
            {t('wallet.unlock')}
          </Button>
        </>
      );
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
            {t('wallet.payFromWallet')}
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
          {hasAddress && username !== null ? <OwnAddress username={username} /> : fallback}
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
