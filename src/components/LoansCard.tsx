'use client';

import Link from 'next/link';
import { useId, useState, type ReactElement } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { ButtonLink } from '@/components/ui';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { MyLoan } from '@/lib/api';
import { forumGoalPercent } from '@/lib/forum-goal';
import { definedDueLabel, isCollecting, summarizeLoans, unpricedDueLabels } from '@/lib/loan-repay';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';

/** Props for {@link LoansCard}. */
export interface LoansCardProps {
  /** Surface that owns the card. */
  place: 'welcome' | 'wallet';
}

function localDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compact loan status shown on the welcome and wallet screens. Each loan keeps
 * its own fiat-defined goal bar and label. Shares waiting for a lender's wallet
 * are a muted line of their own, never part of the amount to send.
 *
 * @param props - Card placement.
 * @returns The loan card, or `null` while unavailable or when there are no loans.
 */
export function LoansCard({ place }: LoansCardProps): ReactElement | null {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const { loans } = useMyLoans();
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (loans === null || loans.loans.length === 0) {
    return null;
  }
  const summary = summarizeLoans(loans, numberFormat);
  const collecting = loans.loans.some(isCollecting);
  const definedPayable = definedDueLabel(loans.loans, 'payable', numberFormat);
  const definedWaiting = definedDueLabel(loans.loans, 'waiting', numberFormat);
  const unpricedPayable = unpricedDueLabels(loans.loans, 'payable', numberFormat);
  const unpricedWaiting = unpricedDueLabels(loans.loans, 'waiting', numberFormat);
  const hasWaiting = summary.waitingPeople > 0 || summary.waitingSats !== null;
  const single = summary.count === 1;
  const title = single ? t('welcome.loanTitle') : t('welcome.loansTitle', { count: summary.count });
  const status = single
    ? collecting
      ? t('welcome.loanCollecting')
      : summary.fundedCount === 1
        ? t('welcome.loanFunded')
        : null
    : t('welcome.loansFunded', { funded: summary.fundedCount, count: summary.count });
  const border =
    summary.tone === 'danger'
      ? 'border-app-danger/50'
      : summary.tone === 'success'
        ? 'border-app-success/50'
        : 'border-app-border';
  const money = (sats: number): string => {
    const bitcoin = formatBitcoin(sats, numberFormat);
    const amount = satsToFiatAmount(sats, rateDay, fiat);
    return amount === null
      ? bitcoin
      : `${bitcoin} · ${formatFiatDisplay(amount, fiat, numberFormat)}`;
  };
  const definedWithBitcoin = (defined: string | null, sats: number | null): string | null => {
    if (sats === null) {
      return defined;
    }
    return defined === null ? money(sats) : `${defined} · ${formatBitcoin(sats, numberFormat)}`;
  };
  const waitingAmounts: { amount: string; count: number; key: string }[] = [];
  const pricedWaiting = definedWithBitcoin(definedWaiting, summary.waitingSats);
  if (pricedWaiting !== null) {
    waitingAmounts.push({
      amount: pricedWaiting,
      count: loans.loans.reduce(
        (sum, loan) =>
          sum +
          (loan.due.waitingSats !== null && loan.due.waitingSats > 0 ? loan.due.waitingPeople : 0),
        0,
      ),
      key: 'priced',
    });
  }
  unpricedWaiting.forEach(({ loanIndex, label, people }) => {
    waitingAmounts.push({ amount: label, count: people, key: `unpriced-${loanIndex}` });
  });
  const nextLines = (): string[] => {
    if (summary.next === null) {
      return [];
    }
    const next = summary.next;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const amounts = [
      definedWithBitcoin(next.amount, next.sats),
      ...next.unpriced.map(({ amount }) => amount),
    ].filter((amount): amount is string => amount !== null);
    const tomorrowDue = next.dueOn === localDay(tomorrow);
    const date = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${next.dueOn}T12:00:00`));
    return amounts.map((amount) =>
      tomorrowDue ? t('loans.nextTomorrow', { amount }) : t('loans.nextOn', { date, amount }),
    );
  };
  const pricedPayable = definedWithBitcoin(definedPayable, summary.payableSats);
  const renderGoalBar = (loan: MyLoan): ReactElement => (
    <ForumGoalBar
      sats={loan.sats}
      goalSats={loan.goalSats}
      goalCurrency={loan.goalCurrency}
      goalAmount={loan.goalAmount}
      goalAmountUsd={loan.goalAmountUsd}
      goalAmountChf={loan.goalAmountChf}
      goalAmountEur={loan.goalAmountEur}
      goalAmountPhp={loan.goalAmountPhp}
      amountUsd={loan.amountUsd}
      amountChf={loan.amountChf}
      amountEur={loan.amountEur}
      amountPhp={loan.amountPhp}
      rateDay={rateDay}
    />
  );

  return (
    <section
      aria-label={title}
      className={`w-full rounded-2xl border bg-app-card-muted p-4 ${border}${
        place === 'welcome' ? ' mt-4' : ' -mt-2 max-w-xl'
      }`}
    >
      <div>
        <h2 className="text-sm font-semibold text-app-fg">{title}</h2>
        {status === null ? null : <p className="mt-1 text-sm text-app-muted">{status}</p>}
      </div>
      {single && loans.loans[0] !== undefined ? (
        renderGoalBar(loans.loans[0])
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {loans.loans.map((loan) => (
            <div key={loan.messageId} className="min-w-0">
              <p className="mb-1 truncate text-xs text-app-muted">{loan.text}</p>
              {renderGoalBar(loan)}
            </div>
          ))}
        </div>
      )}
      {summary.fundedCount > 0 ? (
        <div className="mt-3 rounded-xl bg-app-card px-3 py-2">
          {summary.sundayRest ? (
            <p className="font-semibold text-app-fg">{t('loans.sundayRest')}</p>
          ) : summary.payableLoans > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`flex items-center gap-1 text-xs ${
                    summary.behindDays > 0 ? 'font-medium text-app-danger' : 'text-app-muted'
                  }`}
                >
                  {summary.behindDays > 0 ? (
                    <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                  {summary.behindDays === 0
                    ? t('loans.dueToday')
                    : t(summary.behindDays === 1 ? 'loans.behindOne' : 'loans.behindMany', {
                        days: summary.behindDays,
                      })}
                </p>
                {pricedPayable === null ? null : (
                  <p
                    className={`text-base font-semibold tabular-nums lining-nums ${
                      summary.behindDays > 0 ? 'text-app-danger' : 'text-app-fg'
                    }`}
                  >
                    {definedPayable === null ? (
                      <>
                        {formatBitcoin(summary.payableSats as number, numberFormat)}
                        {preferredFiatSuffix(
                          summary.payableSats as number,
                          rateDay,
                          fiat,
                          numberFormat,
                        )}
                      </>
                    ) : (
                      pricedPayable
                    )}
                  </p>
                )}
                {unpricedPayable.map(({ loanIndex, label }) => (
                  <p
                    key={loanIndex}
                    className={`text-base font-semibold tabular-nums lining-nums ${
                      summary.behindDays > 0 ? 'text-app-danger' : 'text-app-fg'
                    }`}
                  >
                    {label}
                  </p>
                ))}
              </div>
              {!summary.payable ? (
                <Link
                  href="/loans/repay"
                  aria-label={t('loans.details')}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-muted transition hover:bg-app-hover hover:text-app-fg"
                >
                  <ChevronRight aria-hidden="true" className="h-5 w-5" />
                </Link>
              ) : (
                <ButtonLink href="/loans/repay" size="sm">
                  {t('wallet.payFromWallet')}
                </ButtonLink>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`flex items-center gap-1 text-sm font-medium ${
                    !hasWaiting ? 'text-app-success' : 'text-app-muted'
                  }`}
                >
                  {!hasWaiting ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
                  {t(!hasWaiting ? 'loans.nothingDue' : 'loans.nothingToSend')}
                </p>
                {nextLines().map((line, index) => (
                  <p key={index} className="text-xs tabular-nums lining-nums text-app-muted">
                    {line}
                  </p>
                ))}
              </div>
              <Link
                href="/loans/repay"
                aria-label={t('loans.details')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-app-muted transition hover:bg-app-hover hover:text-app-fg"
              >
                <ChevronRight aria-hidden="true" className="h-5 w-5" />
              </Link>
            </div>
          )}
          {hasWaiting
            ? waitingAmounts.map(({ amount, count, key }) => (
                <p key={key} className="mt-1 text-xs tabular-nums lining-nums text-app-muted">
                  {t(count === 1 ? 'loans.waitingOne' : 'loans.waitingMany', { amount, count })}
                </p>
              ))
            : null}
        </div>
      ) : summary.sundayRest ? (
        <div className="mt-3 rounded-xl bg-app-card px-3 py-2">
          <p className="font-semibold text-app-fg">{t('loans.sundayRest')}</p>
        </div>
      ) : (
        <Link
          href="/loans/repay"
          className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-app-card px-3 py-2 text-sm font-medium text-app-fg"
        >
          {t(collecting ? 'loans.collectingOpen' : 'forum.repayOpen')}
          <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-app-muted" />
        </Link>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        className="mt-3 flex w-full min-h-11 items-center justify-between text-sm font-medium text-app-fg"
        onClick={() => setOpen((shown) => !shown)}
      >
        {single
          ? t(open ? 'welcome.loanHide' : 'welcome.loanShow')
          : t(open ? 'welcome.loansHide' : 'welcome.loansShow')}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-app-muted transition-transform${open ? ' rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <ul id={listId} className="mt-2 flex flex-col divide-y divide-app-border">
          {loans.loans.map((loan) => (
            <li key={loan.messageId} className="flex min-w-0 items-center gap-3 py-2 text-sm">
              <Link
                href={`/messages/${encodeURIComponent(loan.messageId)}`}
                className="min-w-0 flex-1 truncate font-medium text-app-fg underline underline-offset-2"
              >
                {loan.text}
              </Link>
              <span className="shrink-0 tabular-nums text-app-muted">
                {t('forum.goalPercent', {
                  percent: String(forumGoalPercent(loan.sats, loan.goalSats)),
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
