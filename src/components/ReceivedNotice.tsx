'use client';

import { ArrowDownLeft, X } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { IconButton } from '@/components/ui';
import { useIncomingPayment } from '@/hooks/useIncomingPayment';
import { useSpotRate } from '@/hooks/useSpotRate';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';

/** How long the banner stays, in milliseconds. */
const RECEIVED_NOTICE_MS = 6000;

/**
 * In-app banner for a received payment that completed while the app is open
 * (`useIncomingPayment`; never for a payment the wallet already held when it
 * connected). It slides down at the top centre of the window: a `max-w-sm`
 * card with a success-tinted border, an `ArrowDownLeft` in a success circle,
 * **You received ₿500** (`wallet.receivedNotice`) and under it the default
 * fiat (left out without a usable rate). The text is one
 * `next/link` to `/wallet` that also closes the banner; the icon-only `X`
 * (`wallet.receivedClose`) closes it. It closes itself after 6 s, and a newer
 * payment replaces it and starts the time again. `role="status"`. No system
 * or push notification.
 *
 * @returns The banner, portaled to `document.body`, or `null` without a payment to show.
 */
export function ReceivedNotice(): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const { payment, dismiss } = useIncomingPayment(RECEIVED_NOTICE_MS);
  const rateDay = useSpotRate(payment !== null);

  if (payment === null) {
    return null;
  }
  const fiatAmount = satsToFiatAmount(payment.amountSats, rateDay, fiat);

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-3">
      <div
        role="status"
        key={payment.id}
        className="pointer-events-auto flex w-full max-w-sm animate-slide-down items-center gap-3 rounded-2xl border border-app-success/40 bg-app-card py-2 pr-1 pl-4 shadow-lg"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-success/15 text-app-success">
          <ArrowDownLeft aria-hidden="true" className="h-5 w-5" />
        </span>
        <Link
          href="/wallet"
          onClick={dismiss}
          className="min-w-0 flex-1 py-1 text-app-fg no-underline"
        >
          <p className="text-sm font-semibold tabular-nums lining-nums">
            {t('wallet.receivedNotice', {
              amount: formatBitcoin(payment.amountSats, numberFormat),
            })}
          </p>
          {fiatAmount === null ? null : (
            <p className="truncate text-xs tabular-nums lining-nums text-app-muted">
              {formatFiatDisplay(fiatAmount, fiat, numberFormat)}
            </p>
          )}
        </Link>
        <IconButton
          type="button"
          variant="ghost"
          aria-label={t('wallet.receivedClose')}
          onClick={dismiss}
          className="shrink-0"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
    </div>,
    document.body,
  );
}
