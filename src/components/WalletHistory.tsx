'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { Button, Card } from '@/components/ui';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import { useWalletHistory } from '@/hooks/useWalletHistory';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { formatBitcoin } from '@/lib/stats-money';

/**
 * `/wallet` payment list, newest first: direction, Bitcoin amount with the
 * default fiat, date, and the payer's note when there is one. Shown only
 * while the wallet is ready. The next page loads when the end of the list
 * is in view, checked again after every completed load. Nothing renders during the first load.
 *
 * @returns The payments card, or `null` during the first load.
 */
export function WalletHistory(): ReactElement | null {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useLatestRateDay();
  const { status, payments, hasMore, loadMore, retry } = useWalletHistory();
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
          return (
            <li
              key={payment.id}
              className="flex w-full items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
            >
              <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-app-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium text-app-fg">
                    {received ? t('wallet.received') : t('wallet.sent')}
                    {payment.status === 'completed' ? null : (
                      <span className="text-app-subtle">
                        {' · '}
                        {payment.status === 'pending' ? t('wallet.pending') : t('wallet.failed')}
                      </span>
                    )}
                  </span>
                  <span className="text-sm tabular-nums lining-nums text-app-fg">
                    <span>{formatBitcoin(payment.amountSats, numberFormat)}</span>
                    {preferredFiatSuffix(payment.amountSats, rateDay, fiat, numberFormat)}
                  </span>
                </div>
                <time
                  dateTime={new Date(payment.timestamp).toISOString()}
                  className="text-xs text-app-subtle"
                >
                  {formatForumTimeFromMs(payment.timestamp, locale)}
                </time>
                {payment.senderComment === null ? null : (
                  <p className="break-words text-sm text-app-muted">{payment.senderComment}</p>
                )}
              </div>
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
