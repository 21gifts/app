'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { WalletOwnAddress } from '@/components/WalletOwnAddress';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button, Card, IconButton } from '@/components/ui';
import type { LoanRepayActionError, LoanRepayPhase, LoanRepayResult } from '@/hooks/useLoanRepay';
import type { MyLoan, RepaymentWaiting } from '@/lib/api';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import { checkLoanAmount, isCollecting, loanMaxInput } from '@/lib/loan-repay';
import type { NumberFormatStyle } from '@/lib/number-format';
import { formatBitcoin } from '@/lib/stats-money';
import { visualPin } from '@/lib/visual-pin';

/** Props for one loan's free-amount repayment and collecting controls. */
export interface LoanPayMoreProps {
  /** Loan whose own currency and live maximum constrain the field. */
  loan: MyLoan;
  /** Shared wallet/action phase from `useLoanRepay`. */
  phase: LoanRepayPhase;
  /** Typed refusal from the latest close or prepay request. */
  actionError: LoanRepayActionError | null;
  /** Existing wallet failure key when preparing or sending the free payment failed. */
  errorKey: LoanRepayResult['errorKey'];
  /** Recipients returned by the latest prepay request whose wallets are not ready. */
  prepayWaiting?: readonly RepaymentWaiting[];
  /** Ready wallet balance, when known. */
  balanceSats: number | null;
  /** Shortfall from the latest wallet preparation. */
  missingSats: number | null;
  /** Shows the local top-up box when the screen has no due box that can host it. */
  showShortfall: boolean;
  /** The api's Sunday-rest flag; free repayment stays unavailable that day. */
  sundayRest: boolean;
  /** Shows wallet availability here when no due-payment box already shows it. */
  showWalletStatus: boolean;
  /** Whether the shared wallet top-up block is open. */
  topUpOpen: boolean;
  /** Member username used by the shared own-address block. */
  username: string | null;
  /** Formats a whole-sat wallet figure with the screen's preferred fiat when available. */
  formatSats: (sats: number) => string;
  /** Opens the shared top-up state and balance polling. */
  onOpenTopUp: () => void;
  /** Starts a free-amount repayment through the shared wallet path. */
  onPay: (loan: MyLoan, amountText: string) => void;
  /** Permanently stops a still-collecting loan. */
  onCloseCollecting: (loan: MyLoan) => void;
}

type PendingAction = 'pay' | 'close' | null;

const PAY_MORE_ACTION_PINS = new Set([
  'repay-pay-more-server-max',
  'repay-pay-more-error',
  'repay-pay-more-sending',
  'repay-pay-more-waiting',
  'repay-pay-more-shortfall',
]);

function displayLoanAmount(text: string, loan: MyLoan, style: NumberFormatStyle): string {
  return loan.goalCurrency === 'BTC'
    ? formatBitcoin(Number(text), style)
    : formatDefinedGoalAmount(text, loan.goalCurrency, style);
}

const ACTION_ERROR_KEY: Record<
  LoanRepayActionError['code'],
  | 'loans.payMoreInvalid'
  | 'loans.payMoreNothingDue'
  | 'loans.payMoreSunday'
  | 'loans.payMorePaymentOpen'
  | 'loans.payMoreRateLimited'
  | 'loans.payMoreUnavailable'
  | 'loans.payMoreRequirements'
  | 'loans.payMoreRequestError'
> = {
  invalid_amount: 'loans.payMoreInvalid',
  nothing_due: 'loans.payMoreNothingDue',
  sunday_rest: 'loans.payMoreSunday',
  payment_open: 'loans.payMorePaymentOpen',
  rate_limited: 'loans.payMoreRateLimited',
  service_unavailable: 'loans.payMoreUnavailable',
  missing_requirements: 'loans.payMoreRequirements',
  amount_too_high: 'loans.payMoreRequestError',
  too_many_shares: 'loans.payMoreRequestError',
  request_failed: 'loans.payMoreRequestError',
};

/**
 * Free-amount repayment form, Max control, and final end-collecting confirmation for one loan.
 *
 * @param props - See {@link LoanPayMoreProps}.
 * @returns The per-loan controls and, while confirming, a modal dialog.
 */
export function LoanPayMore({
  loan,
  phase,
  actionError,
  errorKey,
  prepayWaiting = [],
  balanceSats,
  missingSats,
  showShortfall,
  sundayRest,
  showWalletStatus,
  topUpOpen,
  username,
  formatSats,
  onOpenTopUp,
  onPay,
  onCloseCollecting,
}: LoanPayMoreProps): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const serverErrorId = `${inputId}-server-error`;
  const noticeId = `${inputId}-notice`;
  const [amount, setAmount] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(() =>
    PAY_MORE_ACTION_PINS.has(visualPin() ?? '') ? 'pay' : null,
  );
  const [confirming, setConfirming] = useState<'pay' | 'close' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverMax, setServerMax] = useState<string | null>(null);
  const collecting = isCollecting(loan);
  const busy = phase === 'preparing' || phase === 'sending' || phase === 'waiting';
  const canPay = phase === 'idle' || phase === 'failed' || phase === 'repaid';
  const walletReady = canPay || phase === 'unconfirmed';
  const effectiveLoan =
    serverMax === null
      ? loan
      : loan.goalCurrency === 'BTC'
        ? { ...loan, maxSats: Number(serverMax) }
        : { ...loan, maxAmount: serverMax };
  const check = checkLoanAmount(amount, effectiveLoan);
  const maxInput = loanMaxInput(effectiveLoan);

  let inputError: string | null = null;
  if (amount.trim() !== '' && !check.ok) {
    if (check.reason === 'above_max' && check.max !== null) {
      inputError = t('loans.payMoreAboveMax', {
        amount: displayLoanAmount(check.max, loan, numberFormat),
      });
    } else if (check.reason === 'invalid') {
      inputError = t(
        loan.goalCurrency === 'BTC' ? 'loans.payMoreInvalidBitcoin' : 'loans.payMoreInvalidFiat',
      );
    }
  }
  if (maxInput === null || (!check.ok && check.reason === 'no_max')) {
    inputError = t('loans.payMoreNoRate', { code: loan.goalCurrency });
  }

  useEffect(() => {
    setServerMax(null);
  }, [loan.maxAmount, loan.maxSats, loan.messageId]);

  useEffect(() => {
    if (actionError === null || pendingAction === null) {
      return;
    }
    if (
      pendingAction === 'pay' &&
      (actionError.code === 'amount_too_high' || actionError.code === 'too_many_shares')
    ) {
      const currentMax =
        loan.goalCurrency === 'BTC'
          ? actionError.maxSats === null
            ? null
            : String(actionError.maxSats)
          : actionError.maxAmount;
      if (currentMax !== null) {
        setServerMax(currentMax);
        setAmount(currentMax);
        setServerError(
          t('loans.payMoreMaxChanged', {
            amount: displayLoanAmount(currentMax, loan, numberFormat),
          }),
        );
      } else {
        setServerError(t('loans.payMoreRequestError'));
      }
      return;
    }
    setServerError(t(ACTION_ERROR_KEY[actionError.code]));
  }, [actionError, loan, numberFormat, pendingAction, t]);

  useEffect(() => {
    if (pendingAction === 'pay' && phase === 'repaid') {
      setAmount('');
      setPendingAction(null);
      setServerError(null);
    }
  }, [pendingAction, phase]);

  useEffect(() => {
    if (
      pendingAction === 'pay' &&
      phase === 'failed' &&
      actionError === null &&
      errorKey !== null
    ) {
      setServerError(t(errorKey));
    }
  }, [actionError, errorKey, pendingAction, phase, t]);

  const submitPay = (): void => {
    const current = checkLoanAmount(amount, effectiveLoan);
    if (!current.ok || !canPay || busy || sundayRest) {
      return;
    }
    setConfirming(null);
    setPendingAction('pay');
    setServerError(null);
    onPay(loan, current.text);
  };

  const describedBy = [
    collecting ? noticeId : null,
    inputError !== null ? errorId : null,
    serverError !== null && pendingAction === 'pay' ? serverErrorId : null,
  ]
    .filter(Boolean)
    .join(' ');
  const actionErrorText = serverError;
  const short = showShortfall && pendingAction === 'pay' && missingSats !== null && missingSats > 0;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-app-border pt-4">
      <h3 className="text-sm font-semibold text-app-fg">{t('loans.payMoreTitle')}</h3>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="mb-1 block text-sm text-app-fg">
            {t('loans.payMoreAmount', {
              unit: loan.goalCurrency === 'BTC' ? t('loans.payMoreSats') : loan.goalCurrency,
            })}
          </label>
          <input
            id={inputId}
            type="text"
            inputMode={loan.goalCurrency === 'BTC' ? 'numeric' : 'decimal'}
            autoComplete="off"
            value={amount}
            disabled={busy}
            aria-invalid={inputError === null ? undefined : true}
            aria-describedby={describedBy === '' ? undefined : describedBy}
            onChange={(event) => {
              setAmount(event.target.value);
              setServerError(null);
              setPendingAction(null);
            }}
            className="min-h-11 w-full rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-base tabular-nums lining-nums text-app-fg placeholder:text-app-subtle disabled:opacity-50"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || maxInput === null}
          onClick={() => {
            if (maxInput !== null) {
              setAmount(maxInput);
              setServerError(null);
              setPendingAction(null);
            }
          }}
        >
          {t('loans.payMoreMax')}
        </Button>
      </div>
      {inputError === null ? null : (
        <p id={errorId} className="text-sm text-app-danger">
          {inputError}
        </p>
      )}
      {actionErrorText === null || pendingAction === 'close' ? null : (
        <p id={serverErrorId} role="alert" className="text-sm text-app-danger">
          {actionErrorText}
        </p>
      )}
      {collecting ? (
        <p id={noticeId} className="text-sm text-app-muted">
          {t('loans.payMoreCollectingNotice')}
        </p>
      ) : null}
      {prepayWaiting.map((row) => (
        <p
          key={`${row.dayIndex}:${row.recipientAccountId}`}
          className="flex items-baseline justify-between gap-3 text-sm text-app-muted"
        >
          <span>{t('loans.waitingFor', { name: row.name })}</span>
          <span className="shrink-0 tabular-nums lining-nums">
            {row.amount === null
              ? formatBitcoin(row.amountSats, numberFormat)
              : displayLoanAmount(row.amount, loan, numberFormat)}
          </span>
        </p>
      ))}
      {sundayRest ? <p className="text-sm text-app-muted">{t('loans.payMoreSunday')}</p> : null}
      {!showWalletStatus || walletReady || busy ? null : phase === 'setupFailed' ? (
        <WalletSetupNote />
      ) : phase === 'connecting' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-app-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('wallet.payPreparing')}
        </p>
      ) : (
        <p role="status" className="text-sm text-app-muted">
          {t('wallet.payUnavailable')}
        </p>
      )}
      {pendingAction === 'pay' && phase === 'unconfirmed' ? (
        <p role="status" className="text-sm text-app-muted">
          {t('wallet.payUnconfirmed')}
        </p>
      ) : null}
      {short ? (
        <div className="rounded-xl border border-app-border bg-app-card p-3">
          <p className="font-semibold text-app-fg">{t('loans.short')}</p>
          <p className="mt-1 text-sm tabular-nums lining-nums text-app-muted">
            {t('loans.shortDetail', {
              balance: balanceSats === null ? '–' : formatSats(balanceSats),
              missing: formatSats(missingSats ?? 0),
            })}
          </p>
          {!topUpOpen ? (
            <Button className="mt-3" type="button" size="lg" onClick={onOpenTopUp}>
              {t('loans.topUp')}
            </Button>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-3">
              {username === null ? null : <WalletOwnAddress username={username} copy />}
              <p className="flex items-center gap-2 text-sm text-app-muted" role="status">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                {t('loans.topUpWaiting')}
              </p>
            </div>
          )}
        </div>
      ) : null}
      {busy && pendingAction === 'pay' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-app-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('loans.payMoreSending')}
        </p>
      ) : (
        <Button
          type="button"
          size="lg"
          disabled={!check.ok || !canPay || busy || sundayRest}
          onClick={() => {
            if (!check.ok) {
              return;
            }
            if (collecting) {
              setConfirming('pay');
            } else {
              submitPay();
            }
          }}
        >
          {t('loans.payMorePay')}
        </Button>
      )}
      {collecting ? (
        <Button
          type="button"
          size="lg"
          variant="secondary"
          disabled={busy}
          onClick={() => setConfirming('close')}
        >
          {t('loans.endCollecting')}
        </Button>
      ) : null}
      {busy && pendingAction === 'close' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-app-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('loans.endCollectingClosing')}
        </p>
      ) : null}
      {actionErrorText === null || pendingAction !== 'close' ? null : (
        <p role="alert" className="text-sm text-app-danger">
          {actionErrorText}
        </p>
      )}
      {confirming === null ? null : (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t(
            confirming === 'pay' ? 'loans.payMoreConfirmTitle' : 'loans.endCollectingTitle',
          )}
          data-covers-chrome
          className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
        >
          <Card maxWidth="sm">
            <div className="flex w-full items-start justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-app-fg">
                {t(confirming === 'pay' ? 'loans.payMoreConfirmTitle' : 'loans.endCollectingTitle')}
              </h2>
              <IconButton
                type="button"
                variant="ghost"
                size="md"
                aria-label={t('loans.confirmClose')}
                onClick={() => setConfirming(null)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
            <p className="text-sm text-app-muted">
              {t(confirming === 'pay' ? 'loans.payMoreConfirmBody' : 'loans.endCollectingBody')}
            </p>
            {confirming === 'pay' && check.ok ? (
              <Button type="button" size="lg" onClick={submitPay}>
                {t('loans.payMoreConfirmAction', {
                  amount: displayLoanAmount(check.text, loan, numberFormat),
                })}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  setConfirming(null);
                  setPendingAction('close');
                  setServerError(null);
                  onCloseCollecting(loan);
                }}
              >
                {t('loans.endCollectingConfirm')}
              </Button>
            )}
            <Button type="button" size="lg" variant="secondary" onClick={() => setConfirming(null)}>
              {t('loans.confirmCancel')}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
