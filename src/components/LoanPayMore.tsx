'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { WalletOwnAddress } from '@/components/WalletOwnAddress';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button, Card, IconButton } from '@/components/ui';
import type {
  LoanRepayActionError,
  LoanRepayActiveAction,
  LoanRepayPhase,
  LoanRepayResult,
} from '@/hooks/useLoanRepay';
import type { MyLoan, RepaymentWaiting } from '@/lib/api';
import type { AmountUnit } from '@/lib/api-types';
import {
  checkLoanAmount,
  isCollecting,
  loanMaxInput,
  loanMaxUnits,
  type LoanAmountCheck,
} from '@/lib/loan-repay';
import type { NumberFormatStyle } from '@/lib/number-format';
import {
  fiatPrefix,
  formatBitcoin,
  parseAmountDraft,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

/** Props for one loan's free-amount repayment and collecting controls. */
export interface LoanPayMoreProps {
  /** Loan whose own currency and live maximum constrain the field. */
  loan: MyLoan;
  /** Shared wallet/action phase from `useLoanRepay`. */
  phase: LoanRepayPhase;
  /** Initiating flow; shared status belongs only to its matching loan. */
  activeAction?: LoanRepayActiveAction | null;
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
  /** Current spot used by AmountEntry and to price a typed fiat repayment in sats. */
  rateDay?: FiatRateDay | null;
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
  /** Starts a repayment with the unchanged string typed in the loan unit. */
  onPay: (loan: MyLoan, amountText: string) => void;
  /** Permanently stops a still-collecting loan. */
  onCloseCollecting: (loan: MyLoan) => void;
}

type PendingAction = 'pay' | 'close' | null;

interface ServerMaximum {
  maxSats: number | null;
  maxAmount: string | null;
}

function displayLoanAmount(
  text: string,
  sats: number,
  loan: MyLoan,
  style: NumberFormatStyle,
  formatSats: (sats: number) => string,
): string {
  if (loan.goalCurrency === 'BTC') {
    return formatSats(Number(text));
  }
  return `${fiatPrefix(loan.goalCurrency)}${text.trim()} · ${formatBitcoin(sats, style)}`;
}

function maxDraft(loan: MyLoan): string | null {
  if (loan.maxSats === null || loan.maxSats === undefined) {
    return null;
  }
  return loan.goalCurrency === 'BTC' ? String(loan.maxSats) : (loan.maxAmount ?? null);
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
 * Fixed-loan-unit repayment form, Max control, and final end-collecting confirmation for one loan.
 *
 * @param props - See {@link LoanPayMoreProps}.
 * @returns The per-loan controls and, while confirming, a modal dialog.
 */
export function LoanPayMore({
  loan,
  phase,
  activeAction = null,
  actionError,
  errorKey,
  prepayWaiting = [],
  balanceSats,
  missingSats,
  showShortfall,
  sundayRest,
  rateDay = null,
  showWalletStatus,
  topUpOpen,
  username,
  formatSats,
  onOpenTopUp,
  onPay,
  onCloseCollecting,
}: LoanPayMoreProps): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const amountId = `${useId()}-loan-pay-more`;
  const [amount, setAmount] = useState('');
  const [exactLoanAmount, setExactLoanAmount] = useState<string | null>(null);
  const [exactLoanSats, setExactLoanSats] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirming, setConfirming] = useState<'pay' | 'close' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverAmountInvalid, setServerAmountInvalid] = useState(false);
  const [serverMaximum, setServerMaximum] = useState<ServerMaximum | null>(null);
  const processedActionError = useRef<string | null>(null);
  const collecting = isCollecting(loan);
  const entryFiat: FiatCode = loan.goalCurrency === 'BTC' ? fiat : loan.goalCurrency;
  const amountUnit: AmountUnit = loan.goalCurrency === 'BTC' ? 'btc' : 'fiat';
  const matchingAction =
    activeAction !== null && activeAction.messageId === loan.messageId ? activeAction.kind : null;
  const activePendingAction: PendingAction =
    matchingAction === 'prepay' ? 'pay' : matchingAction === 'close' ? 'close' : null;
  const shownPendingAction = activePendingAction ?? pendingAction;
  const sharedBusy = phase === 'preparing' || phase === 'sending' || phase === 'waiting';
  const busy = sharedBusy && (matchingAction !== null || activeAction === null);
  const canPay = phase === 'idle' || phase === 'failed' || phase === 'repaid';
  const walletReady = canPay || phase === 'unconfirmed';
  const effectiveLoan = serverMaximum === null ? loan : { ...loan, ...serverMaximum };
  const parsed = parseAmountDraft(amountUnit, amount, rateDay, entryFiat);
  let loanAmountText = exactLoanAmount;
  if (loanAmountText === null && parsed.kind === 'sats') {
    loanAmountText = loan.goalCurrency === 'BTC' ? String(parsed.sats) : amount.trim();
  }
  const check: LoanAmountCheck =
    amount.trim() === ''
      ? checkLoanAmount('', effectiveLoan)
      : (parsed.kind !== 'sats' && exactLoanSats === null) || loanAmountText === null
        ? { ok: false, reason: 'invalid', max: loanMaxInput(effectiveLoan) }
        : checkLoanAmount(loanAmountText, effectiveLoan);
  const paymentEnabled = check.ok && !serverAmountInvalid && canPay && !sharedBusy && !sundayRest;
  const apiMaxText = loanMaxUnits(effectiveLoan) === null ? null : loanMaxInput(effectiveLoan);
  const apiMax =
    loanMaxUnits(effectiveLoan) === null ||
    apiMaxText === null ||
    typeof effectiveLoan.maxSats !== 'number'
      ? null
      : { input: apiMaxText, sats: effectiveLoan.maxSats };
  const maxInput = maxDraft(effectiveLoan);

  let inputError: string | null = null;
  if (amount.trim() !== '' && !check.ok) {
    if (check.reason === 'above_max' && check.max !== null) {
      inputError = t('loans.payMoreAboveMax', {
        amount: displayLoanAmount(
          check.max,
          Number(effectiveLoan.maxSats),
          loan,
          numberFormat,
          formatSats,
        ),
      });
    } else if (check.reason === 'invalid') {
      inputError = t(
        amountUnit === 'btc' ? 'loans.payMoreInvalidBitcoin' : 'loans.payMoreInvalidFiat',
      );
    }
  }
  if (parsed.kind === 'no-rate' && exactLoanSats === null) {
    inputError = t('loans.payMoreNoRate', { code: entryFiat });
  } else if (apiMax === null || (!check.ok && check.reason === 'no_max')) {
    inputError =
      loan.goalCurrency !== 'BTC' &&
      (effectiveLoan.maxSats === null || effectiveLoan.maxSats === undefined)
        ? t('loans.payMoreNoRate', { code: loan.goalCurrency })
        : t('loans.payMoreNoMaximum', { code: loan.goalCurrency });
  }

  useEffect(() => {
    setServerMaximum(null);
    setServerAmountInvalid(false);
  }, [loan.maxAmount, loan.maxSats, loan.messageId]);

  useEffect(() => {
    if (actionError === null) {
      processedActionError.current = null;
      return;
    }
    if (actionError.messageId !== loan.messageId || shownPendingAction === null) {
      return;
    }
    const errorGeneration = `${actionError.messageId}:${actionError.code}:${String(
      actionError.maxSats,
    )}:${String(actionError.maxAmount)}`;
    if (processedActionError.current === errorGeneration) {
      return;
    }
    processedActionError.current = errorGeneration;
    setServerAmountInvalid(false);
    if (shownPendingAction === 'pay' && actionError.code === 'invalid_amount') {
      setServerError(null);
      setServerAmountInvalid(true);
      return;
    }
    if (
      shownPendingAction === 'pay' &&
      (actionError.code === 'amount_too_high' || actionError.code === 'too_many_shares')
    ) {
      const currentLoan = {
        ...loan,
        maxSats: actionError.maxSats,
        maxAmount: actionError.maxAmount,
      };
      const currentMax = loanMaxUnits(currentLoan) === null ? null : maxDraft(currentLoan);
      // The non-null units guard above requires the same API maximum as loanMaxInput.
      const currentApiMax = loanMaxInput(currentLoan);
      setServerMaximum({
        maxSats: actionError.maxSats,
        maxAmount: actionError.maxAmount,
      });
      if (currentMax !== null) {
        setAmount(currentMax);
        setExactLoanAmount(currentApiMax);
        setExactLoanSats(actionError.maxSats);
        setServerError(
          t('loans.payMoreMaxChanged', {
            amount: displayLoanAmount(
              currentApiMax as string,
              Number(actionError.maxSats),
              loan,
              numberFormat,
              formatSats,
            ),
          }),
        );
      } else {
        setServerError(t('loans.payMoreRequestError'));
      }
      return;
    }
    setServerError(t(ACTION_ERROR_KEY[actionError.code]));
  }, [actionError, entryFiat, formatSats, loan, numberFormat, rateDay, shownPendingAction, t]);

  useEffect(() => {
    if (shownPendingAction === 'pay' && matchingAction === 'prepay' && phase === 'repaid') {
      setAmount('');
      setExactLoanAmount(null);
      setExactLoanSats(null);
      setPendingAction(null);
      setServerError(null);
      setServerAmountInvalid(false);
    }
  }, [matchingAction, phase, shownPendingAction]);

  useEffect(() => {
    if (
      shownPendingAction === 'pay' &&
      matchingAction === 'prepay' &&
      phase === 'failed' &&
      actionError === null &&
      errorKey !== null
    ) {
      setServerError(t(errorKey));
    }
  }, [actionError, errorKey, matchingAction, phase, shownPendingAction, t]);

  const submitPay = (amountText: string): void => {
    setConfirming(null);
    setPendingAction('pay');
    setServerError(null);
    onPay(loan, amountText);
  };

  const serverAmountError = serverAmountInvalid
    ? t(amountUnit === 'btc' ? 'loans.payMoreInvalidBitcoin' : 'loans.payMoreInvalidFiat')
    : null;
  const fieldError = inputError ?? serverAmountError;
  const actionErrorText = shownPendingAction === 'pay' && fieldError !== null ? null : serverError;
  const shortfall =
    showShortfall &&
    matchingAction === 'prepay' &&
    shownPendingAction === 'pay' &&
    missingSats !== null &&
    missingSats > 0
      ? missingSats
      : null;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-app-border pt-4">
      <h3 className="text-sm font-semibold text-app-fg">{t('loans.payMoreTitle')}</h3>
      <div className="flex items-end gap-2">
        <AmountEntry
          id={amountId}
          className="min-w-0 flex-1"
          label={t('loans.payMoreAmount', {
            unit: amountUnit === 'btc' ? t('loans.payMoreSats') : entryFiat,
          })}
          value={amount}
          valueUnit={amountUnit}
          fixedUnit={amountUnit}
          fiatCode={entryFiat}
          rateDay={rateDay}
          counterSats={amountUnit === 'fiat' ? exactLoanSats : null}
          disabled={sharedBusy}
          {...(fieldError === null ? {} : { error: fieldError })}
          onValueChange={(value) => {
            setAmount(value);
            setExactLoanAmount(null);
            setExactLoanSats(null);
            setServerError(null);
            setServerAmountInvalid(false);
            setPendingAction(null);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={sharedBusy || maxInput === null || apiMax === null}
          onClick={() => {
            if (maxInput !== null && apiMax !== null) {
              setAmount(maxInput);
              setExactLoanAmount(apiMax.input);
              setExactLoanSats(apiMax.sats);
              setServerError(null);
              setServerAmountInvalid(false);
              setPendingAction(null);
            }
          }}
        >
          {t('loans.payMoreMax')}
        </Button>
      </div>
      {actionErrorText === null || shownPendingAction === 'close' ? null : (
        <p role="alert" className="text-sm text-app-danger">
          {actionErrorText}
        </p>
      )}
      {collecting ? (
        <p className="text-sm text-app-muted">{t('loans.payMoreCollectingNotice')}</p>
      ) : null}
      {matchingAction === 'prepay'
        ? prepayWaiting.map((row) => (
            <p
              key={`${row.dayIndex}:${row.recipientAccountId}`}
              className="flex items-baseline justify-between gap-3 text-sm text-app-muted"
            >
              <span>{t('loans.waitingFor', { name: row.name })}</span>
              <span className="shrink-0 tabular-nums lining-nums">
                {row.amount === null
                  ? formatSats(row.amountSats)
                  : displayLoanAmount(row.amount, row.amountSats, loan, numberFormat, formatSats)}
              </span>
            </p>
          ))
        : null}
      {sundayRest ? <p className="text-sm text-app-muted">{t('loans.payMoreSunday')}</p> : null}
      {!showWalletStatus ||
      walletReady ||
      sharedBusy ||
      (activeAction !== null && matchingAction === null) ? null : phase === 'setupFailed' ? (
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
      {matchingAction === 'prepay' && shownPendingAction === 'pay' && phase === 'unconfirmed' ? (
        <p role="status" className="text-sm text-app-muted">
          {t('wallet.payUnconfirmed')}
        </p>
      ) : null}
      {shortfall === null ? null : (
        <div className="rounded-xl border border-app-border bg-app-card p-3">
          <p className="font-semibold text-app-fg">{t('loans.short')}</p>
          <p className="mt-1 text-sm tabular-nums lining-nums text-app-muted">
            {t('loans.shortDetail', {
              balance: balanceSats === null ? '–' : formatSats(balanceSats),
              missing: formatSats(shortfall),
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
      )}
      {busy && shownPendingAction === 'pay' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-app-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('loans.payMoreSending')}
        </p>
      ) : (
        <Button
          type="button"
          size="lg"
          disabled={!paymentEnabled}
          onClick={
            paymentEnabled && check.ok
              ? () => {
                  if (collecting) {
                    setConfirming('pay');
                  } else {
                    submitPay(check.text);
                  }
                }
              : undefined
          }
        >
          {t('loans.payMorePay')}
        </Button>
      )}
      {collecting ? (
        <Button
          type="button"
          size="lg"
          variant="secondary"
          disabled={sharedBusy}
          onClick={() => setConfirming('close')}
        >
          {t('loans.endCollecting')}
        </Button>
      ) : null}
      {busy && shownPendingAction === 'close' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-app-muted">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('loans.endCollectingClosing')}
        </p>
      ) : null}
      {actionErrorText === null || shownPendingAction !== 'close' ? null : (
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
            {confirming === 'pay' ? (
              check.ok ? (
                <Button
                  type="button"
                  size="lg"
                  disabled={!paymentEnabled}
                  onClick={paymentEnabled ? () => submitPay(check.text) : undefined}
                >
                  {t('loans.payMoreConfirmAction', {
                    amount: displayLoanAmount(
                      check.text,
                      // A successful check is created only from parsed sats above.
                      exactLoanSats ?? (parsed as { kind: 'sats'; sats: number }).sats,
                      loan,
                      numberFormat,
                      formatSats,
                    ),
                  })}
                </Button>
              ) : (
                <Button type="button" size="lg" disabled>
                  {t('loans.payMorePay')}
                </Button>
              )
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
