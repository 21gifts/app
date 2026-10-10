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
import { forumGoalPercent } from '@/lib/forum-goal';
import { summarizeLoans } from '@/lib/loan-repay';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';

/** Props for {@link LoansCard}. */
export interface LoansCardProps {
  /** Surface that owns the card; the wallet also shows waiting repayments. */
  place: 'welcome' | 'wallet';
}

function localDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compact combined loan status shown on the welcome and wallet screens.
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
  const summary = summarizeLoans(loans);
  const single = summary.count === 1;
  const title = single ? t('welcome.loanTitle') : t('welcome.loansTitle', { count: summary.count });
  const status = single
    ? t(summary.fundedCount === 1 ? 'welcome.loanFunded' : 'welcome.loanCollecting')
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
  const nextLine = (): string | null => {
    if (summary.next === null) {
      return null;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const amount = money(summary.next.sats);
    if (summary.next.dueOn === localDay(tomorrow)) {
      return t('loans.nextTomorrow', { amount });
    }
    const date = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${summary.next.dueOn}T12:00:00`));
    return t('loans.nextOn', { date, amount });
  };

  return (
    <section
      aria-label={title}
      className={`w-full rounded-2xl border bg-app-card-muted p-4 ${border}${
        place === 'welcome' ? ' mt-4' : ''
      }`}
    >
      <div>
        <h2 className="text-sm font-semibold text-app-fg">{title}</h2>
        <p className="mt-1 text-sm text-app-muted">{status}</p>
      </div>
      {single && loans.loans[0] !== undefined ? (
        <ForumGoalBar
          sats={loans.loans[0].sats}
          goalSats={loans.loans[0].goalSats}
          goalCurrency={loans.loans[0].goalCurrency}
          goalAmount={loans.loans[0].goalAmount}
          goalAmountUsd={loans.loans[0].goalAmountUsd}
          goalAmountChf={loans.loans[0].goalAmountChf}
          goalAmountEur={loans.loans[0].goalAmountEur}
          goalAmountPhp={loans.loans[0].goalAmountPhp}
          amountUsd={loans.loans[0].amountUsd}
          amountChf={loans.loans[0].amountChf}
          amountEur={loans.loans[0].amountEur}
          amountPhp={loans.loans[0].amountPhp}
          rateDay={rateDay}
        />
      ) : (
        <ForumGoalBar sats={summary.sats} goalSats={summary.goalSats} rateDay={rateDay} />
      )}
      {summary.fundedCount > 0 ? (
        <div className="mt-3 rounded-xl bg-app-card px-3 py-2">
          {summary.sundayRest ? (
            <p className="font-semibold text-app-fg">{t('loans.sundayRest')}</p>
          ) : summary.payableSats > 0 ? (
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
                <p
                  className={`text-base font-semibold tabular-nums lining-nums ${
                    summary.behindDays > 0 ? 'text-app-danger' : 'text-app-fg'
                  }`}
                >
                  {formatBitcoin(summary.payableSats, numberFormat)}
                  {preferredFiatSuffix(summary.payableSats, rateDay, fiat, numberFormat)}
                </p>
              </div>
              <ButtonLink href="/loans/repay" size="sm">
                {t('wallet.payFromWallet')}
              </ButtonLink>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`flex items-center gap-1 text-sm font-medium ${
                    summary.waitingSats === 0 ? 'text-app-success' : 'text-app-muted'
                  }`}
                >
                  {summary.waitingSats === 0 ? (
                    <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                  ) : null}
                  {t('loans.nothingDue')}
                </p>
                {nextLine() === null ? null : (
                  <p className="text-xs tabular-nums lining-nums text-app-muted">{nextLine()}</p>
                )}
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
          {place === 'wallet' && summary.waitingSats > 0 ? (
            <p className="mt-1 text-xs tabular-nums lining-nums text-app-muted">
              {t(summary.waitingPeople === 1 ? 'loans.waitingOne' : 'loans.waitingMany', {
                amount: money(summary.waitingSats),
                count: summary.waitingPeople,
              })}
            </p>
          ) : null}
        </div>
      ) : null}
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
