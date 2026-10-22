'use client';

import Link from 'next/link';
import { type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { SKELETON_CLASS } from '@/components/MenuAccountHeader';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { useIncomingPayment } from '@/hooks/useIncomingPayment';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWallet } from '@/hooks/useWallet';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';

/** How long the header shows a payment that just arrived, in milliseconds. */
const HEADER_BALANCE_BUMP_MS = 2400;

/**
 * The in-app wallet balance in the signed-in header, left of **Menu**: a
 * small right-aligned two-line text block, the ₿ figure (`text-sm`
 * semibold) over the default fiat (`text-[10px]` muted; left out only
 * without a usable rate), as one `next/link` to `/wallet` with a rounded
 * hover background and at least 36 px of height. While the balance is on its
 * way (the wallet is connecting, is ready without a balance yet, or failed to
 * open and is opened again in the background), a skeleton stands in its
 * place: the same box with two bars as tall as the two text lines
 * (`aria-hidden`, not a link: the screens that need the wallet announce its
 * state themselves), so nothing in the header moves when the amount replaces
 * it. Nothing is rendered without a
 * wallet, or after a failure that is not retried. When a received payment completes while the app
 * is open, the block turns the success colour for 2.4 s and shows the
 * amount with its fiat (`+₿500 · $0.50`) under it.
 * Carries `data-wallet-tour="balance"` for the
 * wallet tour.
 *
 * @returns The balance link, its skeleton while the balance is on its way, or `null`.
 */
export function HeaderBalance(): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const wallet = useWallet();
  const ready = wallet.status === 'ready' && wallet.balanceSats !== null;
  const rateDay = useSpotRate(ready);
  const { payment } = useIncomingPayment(HEADER_BALANCE_BUMP_MS);

  if (!ready || wallet.balanceSats === null) {
    const loading = wallet.status === 'connecting' || wallet.status === 'ready' || wallet.retrying;
    return loading ? (
      <div
        aria-hidden="true"
        data-balance-skeleton=""
        className="mr-1 flex min-h-9 shrink-0 flex-col items-end justify-center px-2"
      >
        <span className="flex h-[17.5px] items-center">
          <span className={`${SKELETON_CLASS} h-3 w-14`} />
        </span>
        <span className="flex h-[12.5px] items-center">
          <span className={`${SKELETON_CLASS} h-2 w-9`} />
        </span>
      </div>
    ) : null;
  }
  const fiatAmount = satsToFiatAmount(wallet.balanceSats, rateDay, fiat);
  return (
    <Link
      href="/wallet"
      data-wallet-tour="balance"
      className={`relative mr-1 flex min-h-9 shrink-0 flex-col items-end justify-center whitespace-nowrap rounded-lg px-2 leading-tight no-underline transition hover:bg-app-hover ${payment === null ? 'text-app-fg' : 'text-app-success'}`}
    >
      <span className="sr-only">{t('wallet.balanceHeading')}</span>
      <span className="text-sm font-semibold tabular-nums lining-nums">
        {formatBitcoin(wallet.balanceSats, numberFormat)}
      </span>
      {fiatAmount === null ? null : (
        <span className="text-[10px] tabular-nums lining-nums text-app-muted">
          {formatFiatDisplay(fiatAmount, fiat, numberFormat)}
        </span>
      )}
      {payment === null ? null : (
        <span
          aria-hidden="true"
          className="absolute top-full right-2 text-[10px] font-semibold tabular-nums lining-nums text-app-success"
        >
          +{formatBitcoin(payment.amountSats, numberFormat)}
          {preferredFiatSuffix(payment.amountSats, rateDay, fiat, numberFormat)}
        </span>
      )}
    </Link>
  );
}
