'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useState, type ReactElement } from 'react';
import { AlertTriangle, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { WalletOwnAddress } from '@/components/WalletOwnAddress';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button } from '@/components/ui';
import { useLoanRepay } from '@/hooks/useLoanRepay';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import { getRepayment, type MyLoan, type MyLoans, type RepaymentLedger } from '@/lib/api';
import { creditSmallestUnits, splitCreditPlan } from '@/lib/credit-plan';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import { dueShares, fittingPrefix, summarizeLoans, type DueShare } from '@/lib/loan-repay';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
} from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

function isFiatCode(code: MyLoan['goalCurrency']): code is FiatCode {
  return code !== 'BTC';
}

function localDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function centsString(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function shortLoanText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 60) {
    return trimmed;
  }
  const lastSpace = trimmed.lastIndexOf(' ', 60);
  const end = lastSpace === -1 ? 60 : lastSpace;
  return `${trimmed.slice(0, end).trimEnd()}…`;
}

/**
 * All-loans repayment screen: live due totals, recipients, one-tap wallet payment,
 * top-up controls, and per-loan progress.
 *
 * @returns The repayment screen body.
 */
export function LoanRepayScreen(): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const account = useAuthStore((state) => state.account);
  const { loans, reload } = useMyLoans();
  const [failed, setFailed] = useState(false);
  const [ledgerRevision, setLedgerRevision] = useState(0);
  const [ledgerById, setLedgerById] = useState<Record<string, RepaymentLedger | null>>({});
  const [whoOpen, setWhoOpen] = useState(false);
  const [paidLoans, setPaidLoans] = useState<MyLoan[]>([]);
  const [sendingSats, setSendingSats] = useState<number | null>(null);
  const whoId = useId();

  const reloadAfterPayment = useCallback(async (): Promise<MyLoans | null> => {
    const body = await reload();
    setFailed(body === null);
    if (body !== null) {
      setLedgerRevision((revision) => revision + 1);
    }
    return body;
  }, [reload]);
  const repay = useLoanRepay({ reload: reloadAfterPayment });

  useEffect(() => {
    let live = true;
    void reload().then((body) => {
      if (live) {
        setFailed(body === null);
      }
    });
    return () => {
      live = false;
    };
  }, [reload]);

  const loanKey = loans?.loans.map((loan) => loan.messageId).join('\u0000') ?? '';
  useEffect(() => {
    if (loanKey === '') {
      return;
    }
    let live = true;
    void Promise.all(
      loanKey
        .split('\u0000')
        .map(async (messageId): Promise<readonly [string, RepaymentLedger | null]> => [
          messageId,
          await getRepayment(messageId),
        ]),
    ).then((entries) => {
      if (live) {
        setLedgerById(Object.fromEntries(entries));
      }
    });
    return () => {
      live = false;
    };
  }, [loanKey, ledgerRevision]);

  if (loans === null) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-1 pb-8">
        <h1 className="sr-only">{t('loans.title')}</h1>
        {failed ? (
          <>
            <p role="alert" className="text-center text-sm text-app-danger">
              {t('loans.loadError')}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setFailed(false);
                void reload().then((body) => setFailed(body === null));
              }}
            >
              {t('wallet.payRetry')}
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-app-subtle" />
            <p role="status" className="text-sm text-app-muted">
              {t('loans.loading')}
            </p>
          </div>
        )}
      </div>
    );
  }

  const fiatOnly = (sats: number): string | null => {
    const amount = satsToFiatAmount(sats, rateDay, fiat);
    return amount === null ? null : formatFiatDisplay(amount, fiat, numberFormat);
  };
  const money = (sats: number): string => {
    const converted = fiatOnly(sats);
    const bitcoin = formatBitcoin(sats, numberFormat);
    return converted === null ? bitcoin : `${bitcoin} · ${converted}`;
  };
  const repaidWithEmptyList =
    loans.loans.length === 0 &&
    repay.phase === 'repaid' &&
    (repay.sentSats > 0 || repay.pinned) &&
    paidLoans.length > 0;

  if (loans.loans.length === 0 && !repaidWithEmptyList) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-1 pb-8">
        <h1 className="sr-only">{t('loans.title')}</h1>
        <p className="text-center text-sm text-app-muted">{t('loans.none')}</p>
      </div>
    );
  }

  const summary = summarizeLoans(loans);
  const ledgers = loans.loans.map((loan) => ledgerById[loan.messageId] ?? null);
  const shares = dueShares(loans.loans, ledgers);
  const ledgersMissing = ledgers.some((ledger) => ledger === null);
  const payable = summary.payableSats;
  const waiting = summary.waitingSats;
  const payablePeople = ledgersMissing
    ? loans.loans.reduce((sum, loan) => sum + loan.due.payablePeople, 0)
    : new Set(shares.filter((share) => share.canReceive).map((share) => share.accountId)).size;
  const today = localDay(new Date());

  const dateLabel = (dueOn: string, long: boolean): string =>
    new Intl.DateTimeFormat(
      locale,
      long
        ? { weekday: 'long', day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'short' },
    ).format(new Date(`${dueOn}T12:00:00`));
  const nextPeople = new Set(
    loans.loans.flatMap((loan, index) => {
      const ledger = ledgers[index];
      if (!ledger) {
        return [];
      }
      return ledger.repayments
        .filter((row) => row.dayIndex === loan.daysDue)
        .map((row) => row.accountId);
    }),
  ).size;
  const nextLine = (): string | null => {
    if (summary.next === null) {
      return null;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextIsTomorrow = summary.next.dueOn === localDay(tomorrow);
    const variables = {
      amount: money(summary.next.sats),
      count: nextPeople,
      date: dateLabel(summary.next.dueOn, true),
    };
    if (nextPeople === 0) {
      return t(nextIsTomorrow ? 'loans.nextTomorrow' : 'loans.nextOn', variables);
    }
    if (nextIsTomorrow) {
      return t(
        nextPeople === 1 ? 'loans.nextTomorrowPerson' : 'loans.nextTomorrowPeople',
        variables,
      );
    }
    return t(nextPeople === 1 ? 'loans.nextOnPerson' : 'loans.nextOnPeople', variables);
  };

  const activeCurrencyLoans = loans.loans.filter((loan) => loan.due.payableSats > 0);
  const definedCode = activeCurrencyLoans[0]?.goalCurrency;
  const sameDefinedCurrency =
    definedCode !== undefined &&
    isFiatCode(definedCode) &&
    activeCurrencyLoans.length > 0 &&
    activeCurrencyLoans.every(
      (loan) => loan.goalCurrency === definedCode && loan.due.payableAmount !== null,
    );
  const definedPayable = sameDefinedCurrency
    ? activeCurrencyLoans.reduce(
        (sum, loan) => sum + (creditSmallestUnits(loan.due.payableAmount as string, false) ?? 0n),
        0n,
      )
    : null;
  const shownSats = payable === 0 ? waiting : payable;
  const bigAmount =
    definedPayable !== null && definedCode !== undefined && isFiatCode(definedCode)
      ? `${formatDefinedGoalAmount(centsString(definedPayable), definedCode, numberFormat)} · ${formatBitcoin(
          payable,
          numberFormat,
        )}`
      : formatBitcoin(shownSats, numberFormat);
  const smallAmount = definedPayable !== null && definedCode === fiat ? null : fiatOnly(shownSats);

  const rowAmount = (share: DueShare): string => {
    // `dueShares` creates every share from this exact loan array and preserves its index.
    const loan = loans.loans[share.loanIndex]!;
    const defined =
      isFiatCode(loan.goalCurrency) && share.amount !== null
        ? formatDefinedGoalAmount(share.amount, loan.goalCurrency, numberFormat)
        : '';
    if (share.sats === null) {
      return defined === '' ? '–' : defined;
    }
    if (defined === '') {
      return money(share.sats);
    }
    const preferred = loan.goalCurrency === fiat ? null : fiatOnly(share.sats);
    return `${defined} · ${formatBitcoin(share.sats, numberFormat)}${
      preferred === null ? '' : ` · ${preferred}`
    }`;
  };

  const partial =
    repay.sentSats > 0 &&
    (repay.phase === 'idle' ||
      repay.phase === 'failed' ||
      (repay.phase === 'repaid' && payable > 0));
  const showRepaid =
    (repay.pinned && repay.phase === 'repaid') ||
    (repay.phase === 'repaid' && repay.sentSats > 0 && payable === 0);
  const paidSource = paidLoans.length > 0 ? paidLoans : loans.loans;
  const lastLoan = paidSource.find((loan) => loan.due.lastPayment);
  const sentAmount = repay.sentSats;
  const successBox = showRepaid ? (
    <div className="w-full rounded-2xl border border-app-success/50 bg-app-card-muted p-4">
      {lastLoan !== undefined && paidSource.length === 1 ? (
        <>
          <p className="flex items-center gap-2 font-semibold text-app-success">
            <Check aria-hidden="true" className="h-5 w-5" />
            {t('loans.lastTitle')}
          </p>
          <p className="mt-2 text-sm text-app-fg">
            {t('loans.lastBody', { amount: money(lastLoan.totalSats) })}
          </p>
        </>
      ) : lastLoan !== undefined ? (
        <>
          <p className="flex items-center gap-2 font-semibold text-app-success">
            <Check aria-hidden="true" className="h-5 w-5" />
            {t('loans.repaid', { amount: money(sentAmount) })}
          </p>
          <p className="mt-2 text-sm text-app-fg">
            {t('loans.lastFor', {
              text: shortLoanText(lastLoan.text),
              amount: money(lastLoan.totalSats),
            })}
          </p>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 font-semibold text-app-success">
            <Check aria-hidden="true" className="h-5 w-5" />
            {t('loans.repaid', { amount: money(sentAmount) })}
          </p>
          {repay.feeSats > 0 ? (
            <p className="mt-1 text-xs tabular-nums lining-nums text-app-muted">
              {t('wallet.payFee', { amount: money(repay.feeSats) })}
            </p>
          ) : null}
        </>
      )}
      {summary.waitingSats > 0 ? (
        <p className="mt-2 text-sm tabular-nums lining-nums text-app-muted">
          {t('loans.waitsLater', { amount: money(summary.waitingSats) })}
        </p>
      ) : null}
      {nextLine() === null ? null : (
        <p className="mt-2 text-sm tabular-nums lining-nums text-app-muted">{nextLine()}</p>
      )}
    </div>
  ) : null;

  const payableShares = shares.filter((share) => share.canReceive);
  const balanceSats = repay.balanceSats;
  const fitting =
    balanceSats === null ? [] : fittingPrefix(payableShares, (share) => share.sats, balanceSats);
  // `fittingPrefix` stops before the first share whose satoshi amount is unknown.
  const fittingSats = fitting.reduce((sum, share) => sum + (share.sats as number), 0);
  const fittingNames = [...new Set(fitting.map((share) => share.name))].join(', ');
  const rememberAndPay = (limitSats?: number): void => {
    setPaidLoans(loans.loans);
    setSendingSats(limitSats === undefined ? payable : fittingSats);
    repay.pay(loans.loans, limitSats);
  };

  const idleControls =
    balanceSats === null ? null : balanceSats >= payable ? (
      <>
        <p className="text-center text-xs tabular-nums lining-nums text-app-muted">
          {t('loans.fromWallet', { amount: money(balanceSats) })}
        </p>
        <Button variant="primary" size="lg" onClick={() => rememberAndPay()}>
          {t('loans.sendAmount', { amount: money(payable) })}
        </Button>
      </>
    ) : (
      <>
        <div className="rounded-xl border border-app-border bg-app-card p-3">
          <p className="font-semibold text-app-fg">{t('loans.short')}</p>
          <p className="mt-1 text-sm tabular-nums lining-nums text-app-muted">
            {t('loans.shortDetail', {
              balance: money(balanceSats),
              missing: money(repay.missingSats ?? Math.max(0, payable - balanceSats)),
            })}
          </p>
          {!repay.topUpOpen ? (
            <Button className="mt-3" variant="primary" size="lg" onClick={repay.openTopUp}>
              {t('loans.topUp')}
            </Button>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-3">
              {account?.username === null || account?.username === undefined ? null : (
                <WalletOwnAddress username={account.username} copy />
              )}
              <p className="flex items-center gap-2 text-sm text-app-muted" role="status">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                {t('loans.topUpWaiting')}
              </p>
            </div>
          )}
        </div>
        {fitting.length > 0 ? (
          <button
            type="button"
            className="text-sm font-medium text-app-fg underline underline-offset-2"
            onClick={() => rememberAndPay(balanceSats)}
          >
            {t('loans.sendNow', {
              amount: money(fittingSats),
              names: fittingNames,
            })}
          </button>
        ) : null}
      </>
    );

  let payArea: ReactElement | null;
  switch (repay.phase) {
    case 'unavailable':
      payArea = (
        <p role="status" className="text-center text-sm text-app-muted">
          {t('wallet.payUnavailable')}
        </p>
      );
      break;
    case 'connecting':
      payArea = (
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-app-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('wallet.payPreparing')}
        </p>
      );
      break;
    case 'setupFailed':
      payArea = <WalletSetupNote />;
      break;
    case 'preparing':
    case 'sending':
    case 'waiting':
      payArea = (
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-app-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('loans.sending', { amount: money(sendingSats ?? payable) })}
        </p>
      );
      break;
    case 'unconfirmed':
      payArea = (
        <p role="status" className="text-center text-sm text-app-muted">
          {t('wallet.payUnconfirmed')}
        </p>
      );
      break;
    case 'failed':
      payArea = (
        <>
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(repay.errorKey ?? 'forum.payErrorRequest')}
          </p>
          {idleControls}
        </>
      );
      break;
    case 'idle':
      payArea = idleControls;
      break;
    case 'repaid':
      payArea = showRepaid ? null : idleControls;
      break;
  }

  const regularDueBox = (
    <div
      className={`w-full rounded-2xl border bg-app-card-muted p-4 ${
        summary.behindDays > 0 ? 'border-app-danger/50' : 'border-app-border'
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          summary.behindDays > 0 ? 'text-app-danger' : 'text-app-fg'
        }`}
      >
        {partial
          ? t('loans.stillDue')
          : summary.behindDays > 0
            ? t(summary.behindDays === 1 ? 'loans.behindOne' : 'loans.behindMany', {
                days: summary.behindDays,
              })
            : summary.lastPayment && loans.loans.length === 1
              ? t('loans.dueLast')
              : t('loans.dueToday')}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums lining-nums text-app-fg">
        {bigAmount}
      </p>
      {smallAmount === null ? null : (
        <p className="text-sm tabular-nums lining-nums text-app-muted">{smallAmount}</p>
      )}
      <p className="mt-2 text-sm text-app-muted">
        {t(payablePeople === 1 ? 'loans.toOne' : 'loans.toMany', { count: payablePeople })}
        {summary.payableLoans > 1
          ? ` · ${t('loans.loansCount', { count: summary.payableLoans })}`
          : ''}
      </p>
      {waiting > 0 ? (
        <div className="mt-3 flex gap-2 rounded-xl bg-app-notice px-3 py-2 text-sm text-app-notice-fg">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" />
          <p>
            {payable > 0
              ? t(summary.waitingPeople === 1 ? 'loans.waitsOne' : 'loans.waitsMany', {
                  amount: money(waiting),
                  count: summary.waitingPeople,
                })
              : t(summary.waitingPeople === 1 ? 'loans.waitsAllOne' : 'loans.waitsAllMany')}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={whoOpen}
        aria-controls={whoId}
        className="mt-3 flex w-full min-h-11 items-center justify-between text-sm font-medium text-app-fg"
        onClick={() => setWhoOpen((open) => !open)}
      >
        {t('loans.whoGetsPaid')}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-app-muted transition-transform${whoOpen ? ' rotate-180' : ''}`}
        />
      </button>
      {whoOpen ? (
        <div id={whoId} className="mt-2 flex flex-col gap-3">
          {loans.loans.map((loan, loanIndex) => {
            const rows = shares.filter((share) => share.loanIndex === loanIndex);
            if (rows.length === 0) {
              return null;
            }
            return (
              <div key={loan.messageId}>
                {loans.loans.length > 1 ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-app-muted">
                    {loan.text}
                  </p>
                ) : null}
                <ul className="flex flex-col divide-y divide-app-border text-sm">
                  {rows.map((share) => (
                    <li
                      key={`${share.dayIndex}-${share.accountId}`}
                      className={`flex items-center gap-2 py-2 ${
                        share.canReceive
                          ? ''
                          : '-mx-2 rounded-lg bg-app-notice px-2 text-app-notice-fg'
                      }`}
                    >
                      {share.canReceive ? null : (
                        <AlertTriangle
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-app-accent"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="text-app-fg">{share.name}</span>
                        {share.dueOn !== null && share.dueOn < today ? (
                          <span className="text-app-muted">
                            {' · '}
                            {dateLabel(share.dueOn, false)}
                          </span>
                        ) : null}
                        {share.canReceive ? null : (
                          <span className="block text-xs">{t('loans.noWallet')}</span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums lining-nums text-app-fg">
                        {rowAmount(share)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
      {partial ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-app-success">
          <Check aria-hidden="true" className="h-4 w-4" />
          {t('loans.sent', { amount: money(repay.sentSats), names: repay.sentNames.join(', ') })}
        </p>
      ) : null}
      {payable > 0 ? <div className="mt-4 flex flex-col gap-3">{payArea}</div> : null}
    </div>
  );

  const dueBox = repaidWithEmptyList ? (
    successBox
  ) : summary.fundedCount === 0 ? null : summary.sundayRest ? (
    <div className="w-full rounded-2xl border border-app-border bg-app-card-muted p-4">
      <p className="font-semibold text-app-fg">{t('loans.sundayRest')}</p>
    </div>
  ) : successBox !== null ? (
    successBox
  ) : payable === 0 && waiting === 0 ? (
    <div className="w-full rounded-2xl border border-app-success/50 bg-app-card-muted p-4">
      <p className="flex items-center gap-2 font-semibold text-app-success">
        <Check aria-hidden="true" className="h-5 w-5" />
        {t('loans.nothingDue')}
      </p>
      {nextLine() === null ? null : (
        <p className="mt-2 text-sm tabular-nums lining-nums text-app-muted">{nextLine()}</p>
      )}
    </div>
  ) : (
    regularDueBox
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-1 pb-8">
      <h1 className="sr-only">{t('loans.title')}</h1>
      {dueBox}
      {loans.loans.length === 0 ? null : (
        <section
          className="flex flex-col gap-3"
          aria-label={t(loans.loans.length === 1 ? 'loans.listOne' : 'loans.listMany')}
        >
          <h2 className="text-xs uppercase tracking-wide text-app-muted">
            {t(loans.loans.length === 1 ? 'loans.listOne' : 'loans.listMany')}
          </h2>
          {loans.loans.map((loan) => {
            const split =
              loan.goalCurrency === 'BTC'
                ? splitCreditPlan(BigInt(loan.totalSats), loan.termDays)
                : splitCreditPlan(creditSmallestUnits(loan.goalAmount, false) ?? 0n, loan.termDays);
            const planTotal =
              loan.goalCurrency === 'BTC'
                ? money(loan.totalSats)
                : formatDefinedGoalAmount(loan.goalAmount, loan.goalCurrency, numberFormat);
            const planPerDay =
              loan.goalCurrency === 'BTC'
                ? money(Number(split?.perDay ?? 0n))
                : formatDefinedGoalAmount(
                    centsString(split?.perDay ?? 0n),
                    loan.goalCurrency,
                    numberFormat,
                  );
            const repaidText = t('loans.repaidOf', {
              repaid: money(loan.repaidSats),
              total: money(loan.totalSats),
            });
            const repaidPercent =
              loan.totalSats === 0 ? 0 : Math.min(100, (loan.repaidSats / loan.totalSats) * 100);
            return (
              <article
                key={loan.messageId}
                className={loans.loans.length > 1 ? 'rounded-xl border border-app-border p-3' : ''}
              >
                <p className="line-clamp-2 font-medium text-app-fg">{loan.text}</p>
                <p className="mt-1 text-sm tabular-nums lining-nums text-app-muted">
                  {t('loans.plan', {
                    total: planTotal,
                    days: loan.termDays,
                    perDay: planPerDay,
                  })}
                </p>
                {loan.fundedAt === null ? (
                  <p className="mt-2 text-sm text-app-muted">{t('welcome.loanCollecting')}</p>
                ) : (
                  <>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-app-muted">
                      <span className="tabular-nums lining-nums">{repaidText}</span>
                      <span>
                        {t('loans.dayOf', {
                          day: Math.min(loan.daysDue, loan.termDays),
                          days: loan.termDays,
                        })}
                      </span>
                    </div>
                    <svg
                      viewBox="0 0 100 8"
                      preserveAspectRatio="none"
                      role="img"
                      aria-label={repaidText}
                      className="h-2 w-full"
                    >
                      <rect x="0" y="0" width="100" height="8" className="fill-app-border" />
                      <rect
                        x="0"
                        y="0"
                        width={repaidPercent}
                        height="8"
                        className="fill-app-success"
                      />
                    </svg>
                  </>
                )}
                <Link
                  href={`/messages/${encodeURIComponent(loan.messageId)}/repayment-list`}
                  className="mt-2 inline-block text-xs font-medium text-app-fg underline underline-offset-2"
                >
                  {t('forum.creditList')}
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
