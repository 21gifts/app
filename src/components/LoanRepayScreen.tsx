'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useState, type ReactElement } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { LoanPayMore } from '@/components/LoanPayMore';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { WalletOwnAddress } from '@/components/WalletOwnAddress';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button } from '@/components/ui';
import { useLoanRepay } from '@/hooks/useLoanRepay';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import { getRepayment, type MyLoan, type MyLoans, type RepaymentLedger } from '@/lib/api';
import { committedFiatFigure } from '@/lib/committed-fiat';
import { creditSmallestUnits, splitCreditPlan } from '@/lib/credit-plan';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import type { NumberFormatStyle } from '@/lib/number-format';
import {
  centsString,
  definedFiatAmounts,
  definedDueLabel,
  definedFiatSum,
  dueShares,
  fittingPrefix,
  isCollecting,
  summarizeLoans,
  unpricedDueLabels,
  validatedRepaymentPayment,
  type DueShare,
} from '@/lib/loan-repay';
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

/** A stored fiat figure. An unusable string uses the two-decimal display of that same string. */
function exactStoredFiat(amount: string, code: FiatCode, style: NumberFormatStyle): string {
  const exact = formatDefinedGoalAmount(amount, code, style);
  return exact === '' ? formatFiatDisplay(amount, code, style) : exact;
}

function localDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function shareKey(share: Pick<DueShare, 'messageId' | 'dayIndex' | 'accountId'>): string {
  return `${share.messageId}:${share.dayIndex}:${share.accountId}`;
}

/** POST /messages/:id/repayment/due returns at most 60 bills per call. */
const DUE_BILLS_PER_REQUEST = 60;
type TopUpOwner = 'due' | `prepay:${string}`;

function prepayTopUpOwner(messageId: string): TopUpOwner {
  return `prepay:${messageId}`;
}

/**
 * All-loans repayment screen: live due totals, recipients, one-tap wallet payment,
 * top-up controls, per-loan progress, and each loan's free-amount / end-collecting
 * controls. A closed loan keeps free repayment and loses only collecting actions.
 * The send-now link names at most 60 shares
 * per loan (one due request's limit); if any named share is missing from the due
 * answer, nothing is sent and the screen reloads. For a funded loan with something
 * due (payable or waiting) whose repayment list is missing, the opened Who-gets-paid
 * list shows a muted loading line (with a spinner) while that list is in flight, and
 * a danger error line when it failed to load; each list is applied as it arrives.
 * A share whose lender cannot receive yet (`waiting`) is a muted line that names the
 * lender and is left out of the amount to send; when every due share waits, no
 * amount is asked. A capped full-send total is used only when every payable loan's
 * matching-currency ledger has complete share satoshis equal to its payable total.
 * Behind follows the api's `behindDays`.
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
  const [sendingAmounts, setSendingAmounts] = useState<
    { code: MyLoan['goalCurrency']; amount: string | null }[]
  >([]);
  const [topUpOwner, setTopUpOwner] = useState<TopUpOwner | null>(null);
  const whoId = useId();

  const reloadAfterPayment = useCallback(async (): Promise<MyLoans | null> => {
    const body = await reload();
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
    // Each list is applied as it arrives, so a failed one shows its error line without waiting for the rest.
    for (const messageId of loanKey.split('\u0000')) {
      void getRepayment(messageId).then((ledger) => {
        if (live) {
          setLedgerById((current) => ({ ...current, [messageId]: ledger }));
        }
      });
    }
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

  const bitcoinText = (sats: number): string => formatBitcoin(sats, numberFormat);
  const fiatOnly = (sats: number): string | null => {
    const amount = satsToFiatAmount(sats, rateDay, fiat);
    return amount === null ? null : formatFiatDisplay(amount, fiat, numberFormat);
  };
  const money = (sats: number): string => {
    const converted = fiatOnly(sats);
    const bitcoin = bitcoinText(sats);
    return converted === null ? bitcoin : `${bitcoin} · ${converted}`;
  };
  const holding = money;
  const wholeLoanText = (item: MyLoan): string => {
    if (isFiatCode(item.goalCurrency)) {
      return exactStoredFiat(item.goalAmount, item.goalCurrency, numberFormat);
    }
    // Only fiat loans can have an unavailable priced total.
    const totalSats = item.totalSats as number;
    const bitcoin = bitcoinText(totalSats);
    const figure = committedFiatFigure(
      {
        amountCurrency: null,
        amount: null,
        amountUsd: item.goalAmountUsd,
        amountChf: item.goalAmountChf,
        amountEur: item.goalAmountEur,
        amountPhp: item.goalAmountPhp,
      },
      fiat,
    );
    if (figure === null) {
      return money(totalSats);
    }
    return `${bitcoin} · ${formatFiatDisplay(figure.amount, figure.code, numberFormat)}`;
  };
  const completedPrepayTargetMissing =
    repay.phase === 'repaid' &&
    repay.activeAction?.kind === 'prepay' &&
    (repay.sentSats > 0 || repay.pinned) &&
    paidLoans.some((loan) => loan.messageId === repay.activeAction?.messageId) &&
    !loans.loans.some((loan) => loan.messageId === repay.activeAction?.messageId);
  const repaidWithEmptyList =
    loans.loans.length === 0 &&
    repay.phase === 'repaid' &&
    (repay.activeAction?.kind === 'due' || completedPrepayTargetMissing) &&
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

  const summary = summarizeLoans(loans, numberFormat);
  const ledgers = loans.loans.map((loan) => ledgerById[loan.messageId] ?? null);
  const shares = dueShares(loans.loans, ledgers);
  const ledgersMissing = ledgers.some((ledger) => ledger === null);
  const payable = summary.payableSats;
  const waiting = summary.waitingSats;
  const hasPayable = summary.payableLoans > 0;
  const payablePeople = ledgersMissing
    ? loans.loans.reduce((sum, loan) => sum + loan.due.payablePeople, 0)
    : new Set(shares.filter((share) => !share.waiting).map((share) => share.accountId)).size;
  const today = localDay(new Date());

  const dateLabel = (dueOn: string, long: boolean): string =>
    new Intl.DateTimeFormat(
      locale,
      long
        ? { weekday: 'long', day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'short' },
    ).format(new Date(`${dueOn}T12:00:00`));
  const nextPeopleFor = (loanIndexes: readonly number[]): number =>
    new Set(
      loanIndexes.flatMap((index) => {
        const loan = loans.loans[index]!;
        const ledger = ledgers[index];
        if (!ledger) {
          return [];
        }
        return ledger.repayments
          .filter((row) => row.dayIndex === loan.daysDue)
          .map((row) => row.accountId);
      }),
    ).size;
  const nextLines = (): string[] => {
    if (summary.next === null) {
      return [];
    }
    const next = summary.next;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextIsTomorrow = next.dueOn === localDay(tomorrow);
    const pricedAmount: string | null =
      next.sats === null
        ? null
        : next.amount === null
          ? money(next.sats)
          : `${next.amount} · ${bitcoinText(next.sats)}`;
    const pricedIndexes = loans.loans.flatMap((loan, loanIndex) => {
      if (loan.next === null || loan.next.dueOn !== next.dueOn || loan.next.sats === null) {
        return [];
      }
      return loan.next.sats > 0 ? [loanIndex] : [];
    });
    const parts = [
      ...(pricedAmount === null
        ? []
        : [{ amount: pricedAmount, count: nextPeopleFor(pricedIndexes) }]),
      ...next.unpriced.map(({ loanIndex, amount }) => ({
        amount,
        count: nextPeopleFor([loanIndex]),
      })),
    ];
    return parts.map(({ amount, count }) => {
      const variables = { amount, count, date: dateLabel(next.dueOn, true) };
      if (count === 0) {
        return t(nextIsTomorrow ? 'loans.nextTomorrow' : 'loans.nextOn', variables);
      }
      if (nextIsTomorrow) {
        return t(count === 1 ? 'loans.nextTomorrowPerson' : 'loans.nextTomorrowPeople', variables);
      }
      return t(count === 1 ? 'loans.nextOnPerson' : 'loans.nextOnPeople', variables);
    });
  };
  const nextPayment = (): ReactElement | null => {
    const lines = nextLines();
    return lines.length === 0 ? null : (
      <>
        {lines.map((line, index) => (
          <p key={index} className="mt-2 text-sm tabular-nums lining-nums text-app-muted">
            {line}
          </p>
        ))}
      </>
    );
  };

  const definedPayableLabel = definedDueLabel(loans.loans, 'payable', numberFormat);
  const definedWaiting = definedDueLabel(loans.loans, 'waiting', numberFormat);
  const unpricedPayable = unpricedDueLabels(loans.loans, 'payable', numberFormat);
  const unpricedWaiting = unpricedDueLabels(loans.loans, 'waiting', numberFormat);
  const hasUnpricedPayable = loans.loans.some(
    (loan) => loan.due.payableSats === null && loan.due.payablePeople > 0,
  );
  const hasUnpricedWaiting = loans.loans.some(
    (loan) => loan.due.waitingSats === null && loan.due.waitingPeople > 0,
  );
  const pricedWaitingPeople = loans.loans.reduce(
    (sum, loan) =>
      sum +
      (loan.due.waitingSats !== null && loan.due.waitingSats > 0 ? loan.due.waitingPeople : 0),
    0,
  );
  const pricedWaitingLabel: string | null =
    waiting === null || waiting <= 0 || pricedWaitingPeople <= 0
      ? null
      : definedWaiting === null
        ? money(waiting)
        : `${definedWaiting} · ${bitcoinText(waiting)}`;
  const hasWaiting = pricedWaitingLabel !== null || hasUnpricedWaiting;
  const waitingParts = [
    ...(pricedWaitingLabel === null
      ? []
      : [
          {
            key: 'priced',
            label: pricedWaitingLabel,
            people: pricedWaitingPeople,
          },
        ]),
    ...unpricedWaiting.map(({ loanIndex, label, people }) => ({
      key: `unpriced-${loanIndex}`,
      label,
      people,
    })),
  ];
  const partialWaitingNotice = (label: string, people: number): string =>
    t(people === 1 ? 'loans.waitsOne' : 'loans.waitsMany', { amount: label, count: people });
  const payableCurrencies = new Set(
    loans.loans
      .filter((loan) => loan.due.payableSats !== null && loan.due.payableSats > 0)
      .map((loan) => loan.goalCurrency),
  );
  const singlePayableFiat =
    !hasUnpricedPayable && payableCurrencies.size === 1 && !payableCurrencies.has('BTC');
  const bigAmount: string | null =
    payable === null
      ? null
      : definedPayableLabel === null
        ? formatBitcoin(payable, numberFormat)
        : singlePayableFiat
          ? definedPayableLabel
          : `${definedPayableLabel} · ${bitcoinText(payable)}`;
  const smallAmount = payable === null || definedPayableLabel !== null ? null : fiatOnly(payable);

  const rowAmount = (share: DueShare): string => {
    // `dueShares` creates every share from this exact loan array and preserves its index.
    const loan = loans.loans[share.loanIndex]!;
    const defined =
      isFiatCode(loan.goalCurrency) && share.amount !== null
        ? exactStoredFiat(share.amount, loan.goalCurrency, numberFormat)
        : '';
    if (share.sats === null) {
      return defined === '' ? '–' : defined;
    }
    if (defined === '') {
      return money(share.sats);
    }
    return defined;
  };

  const fiatPayLabel = (
    amounts: readonly { code: MyLoan['goalCurrency']; amount: string | null }[],
    sats: number,
  ): string => {
    const defined = definedFiatAmounts(amounts, numberFormat);
    return defined === null ? money(sats) : `${defined} · ${bitcoinText(sats)}`;
  };

  const dueRun = repay.activeAction?.kind === 'due';
  const activeTopUpOwner =
    topUpOwner ??
    (repay.activeAction?.kind === 'prepay'
      ? prepayTopUpOwner(repay.activeAction.messageId)
      : 'due');
  const dueOwnsTopUp = activeTopUpOwner === 'due';
  const partial =
    dueRun &&
    repay.sentSats > 0 &&
    (repay.phase === 'idle' ||
      repay.phase === 'failed' ||
      (repay.phase === 'repaid' && hasPayable));
  const showRepaid =
    dueRun &&
    ((repay.pinned && repay.phase === 'repaid') ||
      (repay.phase === 'repaid' && repay.sentSats > 0 && !hasPayable));
  const paidSource = paidLoans.length > 0 ? paidLoans : loans.loans;
  const prepayTargetId =
    repay.activeAction?.kind === 'prepay' ? repay.activeAction.messageId : null;
  const lastLoan = dueRun
    ? paidSource.find((loan) => loan.due.lastPayment)
    : prepayTargetId !== null
      ? paidLoans.find((loan) => loan.messageId === prepayTargetId)
      : undefined;
  const sentAmount = fiatPayLabel(repay.sentAmounts, repay.sentSats);
  const successBox =
    showRepaid || repaidWithEmptyList || completedPrepayTargetMissing ? (
      <div className="w-full rounded-2xl border border-app-success/50 bg-app-card-muted p-4">
        {lastLoan !== undefined && paidSource.length === 1 ? (
          <>
            <p className="flex items-center gap-2 font-semibold text-app-success">
              <Check aria-hidden="true" className="h-5 w-5" />
              {t('loans.lastTitle')}
            </p>
            <p className="mt-2 text-sm text-app-fg">
              {t('loans.lastBody', { amount: wholeLoanText(lastLoan) })}
            </p>
          </>
        ) : lastLoan !== undefined ? (
          <>
            <p className="flex items-center gap-2 font-semibold text-app-success">
              <Check aria-hidden="true" className="h-5 w-5" />
              {t('loans.repaid', { amount: sentAmount })}
            </p>
            <p className="mt-2 text-sm text-app-fg">
              {t('loans.lastFor', {
                text: shortLoanText(lastLoan.text),
                amount: wholeLoanText(lastLoan),
              })}
            </p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 font-semibold text-app-success">
              <Check aria-hidden="true" className="h-5 w-5" />
              {t('loans.repaid', { amount: sentAmount })}
            </p>
            {repay.feeSats > 0 ? (
              <p className="mt-1 text-xs tabular-nums lining-nums text-app-muted">
                {t('wallet.payFee', { amount: holding(repay.feeSats) })}
              </p>
            ) : null}
          </>
        )}
        {hasWaiting
          ? waitingParts.map(({ key, label }) => (
              <p key={key} className="mt-2 text-sm tabular-nums lining-nums text-app-muted">
                {t('loans.waitsLater', { amount: label })}
              </p>
            ))
          : null}
        {nextPayment()}
      </div>
    ) : null;

  const payableLoans = loans.loans.filter(
    (loan) => loan.due.payableSats !== null && loan.due.payableSats > 0,
  );
  const payableLoanIds = new Set(payableLoans.map((loan) => loan.messageId));
  const payableShares = shares.filter(
    (share) => !share.waiting && payableLoanIds.has(share.messageId),
  );
  const keptByLoan = new Map<string, number>();
  const payableWithinDue = payableShares.filter((share) => {
    const kept = keptByLoan.get(share.messageId) ?? 0;
    if (kept >= DUE_BILLS_PER_REQUEST) {
      return false;
    }
    keptByLoan.set(share.messageId, kept + 1);
    return true;
  });
  const payableLoanAmounts = payableLoans.map((loan) => ({
    code: loan.goalCurrency,
    amount: loan.due.payableAmount,
  }));
  const payableSharesMatchLoans = payableLoans.every((loan) => {
    const ledger = ledgerById[loan.messageId] ?? null;
    const loanShares = payableShares.filter((share) => share.messageId === loan.messageId);
    return (
      ledger !== null &&
      ledger.currency === loan.goalCurrency &&
      loan.due.payableSats !== null &&
      loanShares.every((share) => share.sats !== null) &&
      loanShares.reduce((sum, share) => sum + (share.sats as number), 0) === loan.due.payableSats
    );
  });
  // The full send asks each loan's due endpoint once, which returns at most 60 bills.
  const fullSendFromShares = payableWithinDue.length > 0 && payableSharesMatchLoans;
  const fullSendSats = fullSendFromShares
    ? payableWithinDue.reduce((sum, share) => sum + (share.sats as number), 0)
    : (payable ?? 0);
  const fullSendAmounts = fullSendFromShares
    ? payableWithinDue.map((share) => ({
        code: loans.loans[share.loanIndex]!.goalCurrency,
        amount: share.amount,
      }))
    : payableLoanAmounts;
  const fullSendLabel = fiatPayLabel(fullSendAmounts, fullSendSats);
  const balanceSats = repay.balanceSats;
  const fitting =
    balanceSats === null ? [] : fittingPrefix(payableWithinDue, (share) => share.sats, balanceSats);
  // `fittingPrefix` stops before the first share whose satoshi amount is unknown.
  const fittingSats = fitting.reduce((sum, share) => sum + (share.sats as number), 0);
  const fittingAmounts = fitting.map((share) => ({
    code: loans.loans[share.loanIndex]!.goalCurrency,
    amount: share.amount,
  }));
  const fittingNames = [...new Set(fitting.map((share) => share.name))].join(', ');
  const shareAmounts = new Map(shares.map((share) => [shareKey(share), share.amount] as const));
  const activeSendingAmounts = sendingAmounts.length === 0 ? fullSendAmounts : sendingAmounts;
  const dueMissingSats =
    dueRun && repay.missingSats !== null && repay.missingSats > 0 ? repay.missingSats : null;
  const hasMissingSats = dueMissingSats !== null;
  const otherActionBusy =
    repay.activeAction !== null &&
    repay.activeAction.kind !== 'due' &&
    (repay.phase === 'preparing' || repay.phase === 'sending' || repay.phase === 'waiting');
  const rememberAndPay = (onlyShares?: ReadonlySet<string>): void => {
    setPaidLoans(loans.loans);
    setSendingSats(onlyShares === undefined ? fullSendSats : fittingSats);
    const amounts = onlyShares === undefined ? fullSendAmounts : fittingAmounts;
    setSendingAmounts(amounts);
    repay.pay(payableLoans, onlyShares, shareAmounts);
  };

  const idleControls =
    payable === null || balanceSats === null ? null : balanceSats >= payable && !hasMissingSats ? (
      <>
        <p className="text-center text-xs tabular-nums lining-nums text-app-muted">
          {t('loans.fromWallet', { amount: holding(balanceSats) })}
        </p>
        <Button
          variant="primary"
          size="lg"
          disabled={otherActionBusy}
          onClick={() => rememberAndPay()}
        >
          {t('loans.sendAmount', { amount: fullSendLabel })}
        </Button>
      </>
    ) : (
      <>
        <div className="rounded-xl border border-app-border bg-app-card p-3">
          <p className="font-semibold text-app-fg">{t('loans.short')}</p>
          <p className="mt-1 text-sm tabular-nums lining-nums text-app-muted">
            {t('loans.shortDetail', {
              balance: holding(balanceSats),
              missing: holding(dueMissingSats ?? Math.max(0, payable - balanceSats)),
            })}
          </p>
          {!dueOwnsTopUp || !repay.topUpOpen ? (
            <Button
              className="mt-3"
              variant="primary"
              size="lg"
              disabled={otherActionBusy}
              onClick={() => {
                setTopUpOwner('due');
                repay.openTopUp();
              }}
            >
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
        {(!dueRun || repay.missingSats === null) && !ledgersMissing && fitting.length > 0 ? (
          <button
            type="button"
            disabled={otherActionBusy}
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-app-fg underline underline-offset-2"
            onClick={() => rememberAndPay(new Set(fitting.map(shareKey)))}
          >
            {t('loans.sendNow', {
              amount: fiatPayLabel(fittingAmounts, fittingSats),
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
      payArea = dueRun ? (
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-app-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('loans.sending', {
            amount: fiatPayLabel(activeSendingAmounts, sendingSats ?? (payable as number)),
          })}
        </p>
      ) : (
        idleControls
      );
      break;
    case 'unconfirmed':
      payArea = dueRun ? (
        <p role="status" className="text-center text-sm text-app-muted">
          {t('wallet.payUnconfirmed')}
        </p>
      ) : (
        idleControls
      );
      break;
    case 'failed':
      payArea = dueRun ? (
        <>
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(repay.errorKey ?? 'forum.payErrorRequest')}
          </p>
          {idleControls}
        </>
      ) : (
        idleControls
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
        {!hasPayable
          ? t('loans.nothingToSend')
          : partial
            ? t('loans.stillDue')
            : summary.behindDays > 0
              ? t(summary.behindDays === 1 ? 'loans.behindOne' : 'loans.behindMany', {
                  days: summary.behindDays,
                })
              : summary.lastPayment && loans.loans.length === 1
                ? t('loans.dueLast')
                : t('loans.dueToday')}
      </p>
      {!hasPayable ? null : (
        <>
          {bigAmount === null ? null : (
            <p className="mt-1 text-3xl font-semibold tabular-nums lining-nums text-app-fg">
              {bigAmount}
            </p>
          )}
          {smallAmount === null ? null : (
            <p className="text-sm tabular-nums lining-nums text-app-muted">{smallAmount}</p>
          )}
          {unpricedPayable.map(({ loanIndex, label }) => (
            <p
              key={loanIndex}
              className="mt-1 text-3xl font-semibold tabular-nums lining-nums text-app-fg"
            >
              {label}
            </p>
          ))}
          <p className="mt-2 text-sm text-app-muted">
            {t(payablePeople === 1 ? 'loans.toOne' : 'loans.toMany', { count: payablePeople })}
            {summary.payableLoans > 1
              ? ` · ${t('loans.loansCount', { count: summary.payableLoans })}`
              : ''}
          </p>
        </>
      )}
      {pricedWaitingLabel === null ? null : (
        <p className="mt-3 rounded-xl bg-app-card px-3 py-2 text-sm text-app-muted">
          {payable !== null && payable > 0
            ? partialWaitingNotice(pricedWaitingLabel, pricedWaitingPeople)
            : t(pricedWaitingPeople === 1 ? 'loans.waitsAllOne' : 'loans.waitsAllMany')}
        </p>
      )}
      {pricedWaitingLabel === null && unpricedWaiting.length === 1 ? (
        <p className="mt-3 rounded-xl bg-app-card px-3 py-2 text-sm text-app-muted">
          {partialWaitingNotice(unpricedWaiting[0]!.label, unpricedWaiting[0]!.people)}
        </p>
      ) : unpricedWaiting.length === 0 ? null : (
        <div className="mt-3 flex flex-col gap-1 rounded-xl bg-app-card px-3 py-2 text-sm">
          {unpricedWaiting.map(({ loanIndex, label, people }) => (
            <p key={loanIndex} className="tabular-nums lining-nums text-app-muted">
              {partialWaitingNotice(label, people)}
            </p>
          ))}
        </div>
      )}
      {payable === null ? nextPayment() : null}
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
            const ledger = ledgerById[loan.messageId];
            const showLedgerGap =
              rows.length === 0 &&
              loan.fundedAt !== null &&
              ((loan.due.payableSats === null
                ? loan.due.payablePeople > 0
                : loan.due.payableSats > 0) ||
                (loan.due.waitingSats === null
                  ? loan.due.waitingPeople > 0
                  : loan.due.waitingSats > 0)) &&
              (ledger === undefined || ledger === null);
            if (rows.length === 0 && !showLedgerGap) {
              return null;
            }
            return (
              <div key={loan.messageId}>
                {loans.loans.length > 1 ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-app-muted">
                    {loan.text}
                  </p>
                ) : null}
                {showLedgerGap ? (
                  ledger === undefined ? (
                    <p role="status" className="flex items-center gap-2 text-sm text-app-muted">
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      {t('loans.whoLoading')}
                    </p>
                  ) : (
                    <p role="alert" className="text-sm text-app-danger">
                      {t('loans.whoError')}
                    </p>
                  )
                ) : (
                  <ul className="flex flex-col divide-y divide-app-border text-sm">
                    {rows.map((share) => (
                      <li
                        key={`${share.dayIndex}-${share.accountId}`}
                        className="flex items-center gap-2 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-app-fg">{share.name}</span>
                          {share.dueOn !== null && share.dueOn < today ? (
                            <span className="text-app-muted">
                              {' · '}
                              {dateLabel(share.dueOn, false)}
                            </span>
                          ) : null}
                          {share.waiting ? (
                            <span className="block text-xs text-app-muted">
                              {t('loans.waitingFor', { name: share.name })}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`shrink-0 tabular-nums lining-nums ${
                            share.waiting ? 'text-app-muted' : 'text-app-fg'
                          }`}
                        >
                          {rowAmount(share)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {partial ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-app-success">
          <Check aria-hidden="true" className="h-4 w-4" />
          {t('loans.sent', {
            amount: fiatPayLabel(repay.sentAmounts, repay.sentSats),
            names: repay.sentNames.join(', '),
          })}
        </p>
      ) : null}
      {summary.payable ? <div className="mt-4 flex flex-col gap-3">{payArea}</div> : null}
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
  ) : !hasPayable && !hasWaiting ? (
    <div className="w-full rounded-2xl border border-app-success/50 bg-app-card-muted p-4">
      <p className="flex items-center gap-2 font-semibold text-app-success">
        <Check aria-hidden="true" className="h-5 w-5" />
        {t('loans.nothingDue')}
      </p>
      {nextPayment()}
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
                ? splitCreditPlan(BigInt(loan.totalSats as number), loan.termDays)
                : splitCreditPlan(creditSmallestUnits(loan.goalAmount, false) ?? 0n, loan.termDays);
            const planTotal =
              loan.goalCurrency === 'BTC'
                ? wholeLoanText(loan)
                : exactStoredFiat(loan.goalAmount, loan.goalCurrency, numberFormat);
            const planSlice = (part: 'perDay' | 'last'): string =>
              loan.goalCurrency === 'BTC'
                ? money(Number(split?.[part] ?? 0n))
                : formatDefinedGoalAmount(
                    centsString(split?.[part] ?? 0n),
                    loan.goalCurrency,
                    numberFormat,
                  );
            const planPerDay = planSlice('perDay');
            const uneven = (split?.remainder ?? 0n) !== 0n;
            const ledger = ledgerById[loan.messageId] ?? null;
            let definedRepaid: string | null = null;
            if (
              isFiatCode(loan.goalCurrency) &&
              ledger !== null &&
              ledger.currency === loan.goalCurrency
            ) {
              const paid = ledger.repayments.flatMap((row) => {
                if (row.status === 'paid') {
                  return [{ sats: row.sats, amount: row.amount }];
                }
                const payment = validatedRepaymentPayment(row);
                if (payment.sats === 0n) {
                  return [];
                }
                return [
                  {
                    sats: payment.sats === null ? null : Number(payment.sats),
                    amount: payment.hasAmount
                      ? payment.amount === null
                        ? null
                        : centsString(payment.amount)
                      : null,
                  },
                ];
              });
              const paidSats = paid.every((row) => row.sats !== null)
                ? paid.reduce((sum, row) => sum + (row.sats as number), 0)
                : null;
              if (paid.length > 0 && paidSats === loan.repaidSats) {
                definedRepaid = definedFiatSum(
                  loan.goalCurrency,
                  paid.map((row) => row.amount),
                  numberFormat,
                );
              }
            }
            const repaid =
              definedRepaid === null
                ? money(loan.repaidSats)
                : `${definedRepaid} · ${bitcoinText(loan.repaidSats)}`;
            const repaidText = t('loans.repaidOf', {
              repaid,
              total: wholeLoanText(loan),
            });
            const repaidPercent =
              loan.totalSats === null
                ? null
                : loan.totalSats === 0
                  ? 0
                  : Math.min(100, (loan.repaidSats / loan.totalSats) * 100);
            return (
              <article
                key={loan.messageId}
                className={loans.loans.length > 1 ? 'rounded-xl border border-app-border p-3' : ''}
              >
                <p className="line-clamp-2 font-medium text-app-fg">{loan.text}</p>
                <p className="mt-1 text-sm tabular-nums lining-nums text-app-muted">
                  {uneven
                    ? `${planTotal} · ${t('forum.creditPlanLast', {
                        amount: planPerDay,
                        earlier: loan.termDays - 1,
                        last: planSlice('last'),
                      })}`
                    : t('loans.plan', {
                        total: planTotal,
                        days: loan.termDays,
                        perDay: planPerDay,
                      })}
                </p>
                {isCollecting(loan) ? (
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
                    {repaidPercent === null ? null : (
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
                    )}
                  </>
                )}
                <Link
                  href={`/messages/${encodeURIComponent(loan.messageId)}/repayment-list`}
                  className="mt-2 inline-block text-xs font-medium text-app-fg underline underline-offset-2"
                >
                  {t('forum.creditList')}
                </Link>
                <LoanPayMore
                  loan={loan}
                  phase={repay.phase}
                  activeAction={repay.activeAction}
                  actionError={repay.actionError}
                  errorKey={repay.errorKey}
                  prepayWaiting={
                    repay.prepayMessageId === loan.messageId ? repay.prepayWaiting : []
                  }
                  balanceSats={repay.balanceSats}
                  missingSats={repay.missingSats}
                  showShortfall={
                    payable === null ||
                    payable === 0 ||
                    (repay.activeAction?.kind === 'prepay' &&
                      repay.activeAction.messageId === loan.messageId)
                  }
                  sundayRest={loans.sundayRest}
                  rateDay={rateDay}
                  showWalletStatus={payable === null || payable === 0}
                  topUpOpen={
                    repay.topUpOpen && activeTopUpOwner === prepayTopUpOwner(loan.messageId)
                  }
                  username={account?.username ?? null}
                  formatSats={holding}
                  onOpenTopUp={() => {
                    setTopUpOwner(prepayTopUpOwner(loan.messageId));
                    repay.openTopUp();
                  }}
                  onPay={(item, amountText) => {
                    setPaidLoans(loans.loans);
                    repay.prepay(item, amountText);
                  }}
                  onCloseCollecting={repay.closeCollecting}
                />
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
