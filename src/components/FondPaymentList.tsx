'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { Button } from '@/components/ui';
import { useSpotRate } from '@/hooks/useSpotRate';
import { fetchFondPayments } from '@/lib/api';
import type { FondPayment } from '@/lib/api-types';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import { formatForumTime } from '@/lib/forum-time';
import { formatBitcoin } from '@/lib/stats-money';

/** The ` · ` suffix followed by an already formatted fiat figure. */
function fiatSuffix(text: string): ReactElement {
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span>{text}</span>
    </>
  );
}

/**
 * Appends a page to the list, skipping payments whose ids are already shown.
 *
 * @param current - Payments already loaded.
 * @param page - The next page returned by the API.
 * @returns The merged list without duplicate ids.
 */
function appendPayments(current: FondPayment[], page: FondPayment[]): FondPayment[] {
  const seen = new Set(current.map((payment) => payment.id));
  return [...current, ...page.filter((payment) => !seen.has(payment.id))];
}

/**
 * Read-only payment list of the public Fond.
 *
 * A new component rather than `WalletHistory`: that list reads the connected
 * member's wallet, opens `wallet/payment` details, and labels gifts, loans and
 * shops. The Fond list is public, has no payment detail route, and names the
 * counterparty (or **Private**). It reuses the same row shell, direction
 * icons, `formatBitcoin` + `preferredFiatSuffix` amounts, and formatForumTime
 * as the wallet history. The fee is not shown because no fiat figure fixed
 * for that fee exists.
 *
 * @param props - The Fond handle from the validated summary.
 * @param props.username - Fond handle whose payments are listed.
 * @returns The payments section with loading, empty, error, rows, and paging.
 */
export function FondPaymentList({ username }: { username: string }): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [payments, setPayments] = useState<FondPayment[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    busy.current = false;
    setStatus('loading');
    setPayments([]);
    setNext(null);
    setLoadingMore(false);
    setLoadMoreFailed(false);
    void fetchFondPayments(username).then(
      (page) => {
        if (cancelled) {
          return;
        }
        if (page === null) {
          setStatus('error');
          return;
        }
        setPayments(page.payments);
        setNext(page.next);
        setStatus('ready');
      },
      () => {
        if (cancelled) {
          return;
        }
        setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, username]);

  const loadMore = (): void => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    const requestGeneration = generation.current;
    setLoadMoreFailed(false);
    setLoadingMore(true);
    void fetchFondPayments(username, next).then(
      (page) => {
        if (!mounted.current || generation.current !== requestGeneration) {
          return;
        }
        busy.current = false;
        setLoadingMore(false);
        if (page === null) {
          setLoadMoreFailed(true);
          return;
        }
        setLoadMoreFailed(false);
        setPayments((current) => appendPayments(current, page.payments));
        setNext(page.next);
      },
      () => {
        if (!mounted.current || generation.current !== requestGeneration) {
          return;
        }
        busy.current = false;
        setLoadingMore(false);
        setLoadMoreFailed(true);
      },
    );
  };

  let body: ReactElement;
  if (status === 'loading') {
    body = <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  } else if (status === 'error') {
    body = (
      <div className="flex flex-col items-center gap-3">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('fond.paymentsError')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('view.retry')}
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        {payments.length === 0 && next === null ? (
          <p className="text-center text-sm text-app-muted">{t('wallet.historyEmpty')}</p>
        ) : (
          <ul className="flex w-full flex-col gap-2">
            {payments.map((payment) => {
              const incoming = payment.direction === 'in';
              const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
              const name = payment.counterparty?.name?.trim();
              const username = payment.counterparty?.username ?? '';
              const label =
                name !== undefined && name !== ''
                  ? name
                  : username !== ''
                    ? `@${username}`
                    : t('view.unnamed');
              const storedFiatText =
                payment.storedFiat === null
                  ? null
                  : formatDefinedGoalAmount(
                      payment.storedFiat.amount,
                      payment.storedFiat.currency,
                      numberFormat,
                    );
              const amountFiat =
                storedFiatText === null
                  ? preferredFiatSuffix(payment.amountSats, rateDay, fiat, numberFormat)
                  : fiatSuffix(storedFiatText);
              const counterparty =
                payment.counterparty === null ? (
                  <span className="truncate text-sm text-app-muted">{t('fond.private')}</span>
                ) : (
                  <Link
                    href={`/members/${payment.counterparty.accountId}`}
                    className="truncate text-sm text-app-muted underline underline-offset-2"
                  >
                    {label}
                  </Link>
                );
              return (
                <li key={payment.id} className="w-full">
                  <div className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3 text-app-fg">
                    <Icon
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 self-start mt-0.5 text-app-muted"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-x-3">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {incoming ? t('wallet.received') : t('wallet.sent')}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums lining-nums">
                          {incoming ? '+' : '−'}
                          {formatBitcoin(payment.amountSats, numberFormat)}
                          {amountFiat}
                        </span>
                      </div>
                      <div className="text-xs text-app-subtle">
                        <time dateTime={payment.paidAt}>
                          {formatForumTime(payment.paidAt, locale)}
                        </time>
                      </div>
                      {counterparty}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {loadMoreFailed ? (
          <div className="flex flex-col items-center gap-3">
            <p role="alert" className="text-center text-sm text-app-danger">
              {t('fond.paymentsError')}
            </p>
            <Button type="button" variant="secondary" disabled={loadingMore} onClick={loadMore}>
              {t('view.retry')}
            </Button>
          </div>
        ) : null}
        {loadMoreFailed || next === null ? null : (
          <Button type="button" variant="secondary" disabled={loadingMore} onClick={loadMore}>
            {t('shops.showMore')}
          </Button>
        )}
      </>
    );
  }

  return (
    <section
      aria-label={t('wallet.historyHeading')}
      className="flex w-full flex-col items-center gap-3"
    >
      <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('wallet.historyHeading')}
      </h2>
      {body}
    </section>
  );
}
