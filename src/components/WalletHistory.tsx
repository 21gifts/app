'use client';

import { ArrowDownLeft, ArrowUpRight, ChevronRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { Button, Card } from '@/components/ui';
import { useHeartContext } from '@/hooks/useHeartContext';
import { useShopChargeFigure } from '@/hooks/useShopChargeFigure';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWalletHistory } from '@/hooks/useWalletHistory';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { formatBitcoin, formatFiatDisplay } from '@/lib/stats-money';
import { paymentHref, paymentMessage, paymentTitle } from '@/lib/wallet/payment-display';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

/**
 * Fiat beside a history amount. A shop payment shows the figure stored on its
 * receipt once that read returns. Until then the row stays bitcoin, so a
 * stored 12.00 is not flashed as a spot price. After the read, a charge with
 * no stored figure shows the current spot. Every other payment shows the spot.
 * The spot is not written onto the payment.
 *
 * @param props - The payment's method details and sat amount.
 * @returns The fiat suffix, or `null` while a shop receipt is still out or no rate exists.
 */
function HistoryFiat(props: {
  info: WalletPayment['info'];
  amountSats: number;
}): ReactElement | null {
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const shop = useShopChargeFigure(props.info.purpose === 'shop' ? props.info : null);
  if (props.info.purpose === 'shop') {
    if (shop.pending) {
      return null;
    }
    if (shop.figure !== null) {
      return (
        <>
          <span aria-hidden="true"> · </span>
          <span className="shrink-0 tabular-nums lining-nums">
            {formatFiatDisplay(shop.figure.amount, shop.figure.code, numberFormat)}
          </span>
        </>
      );
    }
  }
  return preferredFiatSuffix(props.amountSats, rateDay, fiat, numberFormat);
}

/**
 * `/wallet` payment list, newest first: direction, Bitcoin amount with one
 * fiat figure, date, and the payer's note when there is one. A shop payment
 * shows the currency figure stored on that charge once the receipt returns.
 * Any other payment, and a shop charge with no stored figure, shows the
 * current spot. Shown only
 * while the wallet is ready. The next page loads when the end of the list
 * is in view, checked again after every completed load. Nothing renders during the first load.
 *
 * @returns The payments card, or `null` during the first load.
 */
export function WalletHistory(): ReactElement | null {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { status, payments, hasMore, loadMore, retry } = useWalletHistory();
  const heartContext = useHeartContext(
    payments.flatMap((payment) =>
      payment.status !== 'pending' &&
      payment.info.purpose === 'gift' &&
      typeof payment.info.paymentHash === 'string'
        ? [payment.info.paymentHash]
        : [],
    ),
  );
  const sentinel = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (node === null || !hasMore || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
    // Re-armed after every completed load (a load always yields a new array,
    // and an error or retry changes the status), so an end of the list that
    // is still in view asks for the next page again.
  }, [hasMore, loadMore, payments, status]);

  if (status === 'loading') {
    return null;
  }

  let body: ReactElement;
  if (status === 'error') {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('wallet.historyError')}
        </p>
        <Button onClick={retry}>{t('login.retry')}</Button>
      </>
    );
  } else if (payments.length === 0) {
    body = <p className="text-center text-sm text-app-muted">{t('wallet.historyEmpty')}</p>;
  } else {
    body = (
      <ul className="flex w-full flex-col gap-2">
        {payments.map((payment) => {
          const received = payment.direction === 'received';
          const Icon = received ? ArrowDownLeft : ArrowUpRight;
          const title = paymentTitle(payment);
          const message = paymentMessage(payment);
          const heartHash =
            payment.status !== 'pending' &&
            payment.info.purpose === 'gift' &&
            typeof payment.info.paymentHash === 'string'
              ? payment.info.paymentHash.toLowerCase()
              : null;
          const heart = heartHash === null ? undefined : heartContext.byHash.get(heartHash);
          const heartTitle =
            heart === undefined
              ? null
              : heart.text.replace(/\r?\n|\r/g, ' ').trim() || heart.authorName;
          return (
            <li key={payment.id} className="w-full">
              <Link
                href={paymentHref(payment.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3 text-app-fg no-underline transition hover:bg-app-hover"
              >
                {heart === undefined ? (
                  <Icon
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 self-start mt-0.5 text-app-muted"
                  />
                ) : (
                  <Heart
                    aria-hidden="true"
                    fill="currentColor"
                    className="h-4 w-4 shrink-0 self-start mt-0.5 text-app-accent"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-x-3">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {heart !== undefined
                        ? heartTitle
                        : 'text' in title
                          ? title.text
                          : t(title.key)}
                    </span>
                    <span
                      className={`shrink-0 text-sm tabular-nums lining-nums${payment.status === 'failed' ? ' text-app-subtle line-through' : ''}`}
                    >
                      {received ? '+' : '−'}
                      {formatBitcoin(payment.amountSats, numberFormat)}
                      <HistoryFiat info={payment.info} amountSats={payment.amountSats} />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-x-3 text-xs text-app-subtle">
                    <time dateTime={new Date(payment.timestamp).toISOString()}>
                      {formatForumTimeFromMs(payment.timestamp, locale)}
                      {payment.status === 'completed' ? null : (
                        <span
                          className={payment.status === 'failed' ? 'text-app-danger' : undefined}
                        >
                          {' · '}
                          {payment.status === 'pending' ? t('wallet.pending') : t('wallet.failed')}
                        </span>
                      )}
                    </time>
                  </div>
                  {message === null ? null : (
                    <p className="truncate text-sm text-app-muted">{message}</p>
                  )}
                </div>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-app-subtle" />
              </Link>
            </li>
          );
        })}
        {hasMore ? <li ref={sentinel} aria-hidden="true" className="h-px w-full" /> : null}
      </ul>
    );
  }

  return (
    <Card surface={false}>
      <section
        aria-label={t('wallet.historyHeading')}
        className="flex w-full flex-col items-center gap-3"
      >
        <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('wallet.historyHeading')}
        </h2>
        {body}
      </section>
    </Card>
  );
}
