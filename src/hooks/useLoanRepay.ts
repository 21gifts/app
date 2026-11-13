'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WALLET_PAY_BALANCE_POLL_MS, WALLET_PAY_CONFIRM_WAIT_MS } from '@/hooks/useWalletPay';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import {
  CannotReceiveError,
  closeLoan,
  LoanRepaymentError,
  postRepaymentDue,
  prepayLoan,
  WalletRequiredError,
  type LoanPrepay,
  type LoanRepaymentErrorCode,
  type MyLoan,
  type MyLoans,
  type RepaymentBill,
  type RepaymentWaiting,
} from '@/lib/api';
import { creditSmallestUnits } from '@/lib/credit-plan';
import { parseLoanAmount } from '@/lib/loan-repay';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { visualPin } from '@/lib/visual-pin';
import { reportPaymentFailure } from '@/lib/wallet/payment-failure';
import { canUnlockWallet } from '@/lib/wallet/wallet-phrase';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import { payFromWallet, refreshWallet, type WalletSendResult } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/**
 * What the pay part of `/loans/repay` shows.
 * - unavailable: the wallet cannot pay here (status 'disabled' or !canUnlockWallet(account)).
 * - connecting: wallet not ready yet, or the one-time setup still due (needsWalletSetup).
 * - setupFailed: setup due and useWalletSetup().failed.
 * - idle: ready; Send / Top up / send-now link may show.
 * - preparing: bills are being fetched and prepared (nothing sent yet). The UI
 *   shows "Sending ₿X…".
 * - sending: bills are being sent.
 * - waiting: sent; polling GET /me/loans for settlement. The UI still shows "Sending ₿X…".
 * - repaid: settlement seen for everything sent.
 * - unconfirmed: still not settled WALLET_PAY_CONFIRM_WAIT_MS after the last send.
 * - failed: the due request, a loans reload, or a prepare failed before anything was sent
 *   (`errorKey` says why), also on a run that had nothing to send, or a send failed (then
 *   `sent` lists what did go out).
 */
export type LoanRepayPhase =
  | 'unavailable'
  | 'connecting'
  | 'setupFailed'
  | 'idle'
  | 'preparing'
  | 'sending'
  | 'waiting'
  | 'repaid'
  | 'unconfirmed'
  | 'failed';

/** State and actions of the all-loans wallet repayment flow. */
export interface LoanRepayResult {
  phase: LoanRepayPhase;
  /** Initiating flow and, for a per-loan action, the matching loan id. */
  activeAction: LoanRepayActiveAction | null;
  /** Wallet balance in whole sats while the wallet is ready, else null. */
  balanceSats: number | null;
  /** Sats of bills that went out in the last run (0 before any). */
  sentSats: number;
  /**
   * Stored amount of every bill that went out in the last run, in send order.
   * A bill's own `amount` wins; otherwise the screen's `shareAmounts` entry for
   * the same loan, day, and recipient supplies its stored loan-currency amount.
   */
  sentAmounts: { code: MyLoan['goalCurrency']; amount: string | null }[];
  /** Names of the recipients paid in the last run, in pay order, without duplicates. */
  sentNames: string[];
  /** Waiting recipients returned by the latest free-amount prepay request. */
  prepayWaiting: RepaymentWaiting[];
  /** Message id whose latest free-amount request returned `prepayWaiting`. */
  prepayMessageId: string | null;
  /** Sum of prepared fees of the bills that went out (0 when none). */
  feeSats: number;
  /**
   * Set when a run stopped because the balance did not cover amount + fees of what it tried:
   * amount + fees − balance, in sats. Null otherwise.
   */
  missingSats: number | null;
  /**
   * Catalog key of the failure line while phase is 'failed':
   * 'forum.payErrorRateLimit' | 'forum.payErrorRequest' | 'wallet.payUnavailable' |
   * 'loans.errorCannotReceive' (the api answered `cannot_receive`: a lender cannot receive yet;
   * the answer does not say which).
   */
  errorKey:
    | 'forum.payErrorRateLimit'
    | 'forum.payErrorRequest'
    | 'wallet.payUnavailable'
    | 'loans.errorCannotReceive'
    | null;
  /** Typed close/prepay refusal; max errors carry the api's current limit. */
  actionError: LoanRepayActionError | null;
  /** True while the top-up block is open. */
  topUpOpen: boolean;
  /** Opens the top-up block (the screen's "Top up your wallet"); starts the balance poll. */
  openTopUp: () => void;
  /**
   * One tap: pays every bill of loans with a known positive `due.payableSats`.
   * `onlyShares` (optional): pay only the bills whose share key
   * (`messageId:dayIndex:recipientAccountId`) is in the set (the "send ₿C now"
   * link passes the named shares). The named shares are taken from all due shares;
   * shares of the set another run already holds are skipped. Only that named set is
   * prepared. The whole set is sent, or nothing: an `insufficient` prepare in the set,
   * or a total that does not fit the current balance, sends nothing. The send-now link
   * names at most 60 shares per loan (one due request's limit); if any named share is
   * missing from the due answer, nothing is sent and the screen reloads. After the due
   * requests, the run reloads for a fresh `repaidSats` baseline; without a fresh body
   * for every loan it would pay, it prepares nothing, sends nothing, and ends `failed`.
   * When the set is given and none of those shares are still due, the run reloads, then
   * ends `unconfirmed` if one of the named shares is held by another run, `repaid` if
   * nothing is due any more, otherwise `idle`. On these runs that send nothing, a
   * failed reload ends `failed` instead.
   *
   * @param loans - Current loans body in list order.
   * @param onlyShares - Optional exact share keys to pay; only those named shares are
   *   prepared. An insufficient prepare in the set, fees that do not fit the
   *   balance, or a named share missing from the due answer, send nothing.
   * @param shareAmounts - Stored loan-currency amounts by share key
   *   (`messageId:dayIndex:recipientAccountId`). Used for a bill whose own `amount` is
   *   null; the screen derives these from the matching `DueShare` rows (same loan, day,
   *   and recipient).
   */
  pay: (
    loans: readonly MyLoan[],
    onlyShares?: ReadonlySet<string>,
    shareAmounts?: ReadonlyMap<string, string | null>,
  ) => void;
  /** Requests a reconciled free-amount split and sends it through the same wallet path as `pay`. */
  prepay: (loan: MyLoan, amountText: string) => void;
  /** Permanently ends collecting for one still-collecting loan, then reloads the loan list. */
  closeCollecting: (loan: MyLoan) => void;
  /** True while a `repay-*` visual pin, including its fixed sent totals, applies. */
  pinned: boolean;
}

/** Close/prepay error state exposed to the repayment screen. */
export interface LoanRepayActionError {
  /** Loan whose close or free repayment produced this refusal. */
  messageId: string;
  code: LoanRepaymentErrorCode | 'missing_requirements';
  maxSats: number | null;
  maxAmount: string | null;
}

/** Flow that owns the shared repayment phase and wallet result. */
export type LoanRepayActiveAction =
  { kind: 'due'; messageId: null } | { kind: 'prepay' | 'close'; messageId: string };

type LivePhase = 'idle' | 'preparing' | 'sending' | 'waiting' | 'repaid' | 'unconfirmed' | 'failed';
type ErrorKey = Exclude<LoanRepayResult['errorKey'], null>;
type OrderedBill = RepaymentBill & { messageId: string };

const ACTIVE_RUN_PHASES = new Set<LivePhase>(['preparing', 'sending', 'waiting']);

function isLoanRepaymentError(error: unknown): error is LoanRepaymentError {
  return error instanceof LoanRepaymentError;
}

function actionErrorOf(error: unknown, messageId: string): LoanRepayActionError | null {
  if (isLoanRepaymentError(error)) {
    return {
      messageId,
      code: error.code,
      maxSats: error.maxSats,
      maxAmount: error.maxAmount,
    };
  }
  if (error instanceof MissingRequirementsError) {
    return { messageId, code: 'missing_requirements', maxSats: null, maxAmount: null };
  }
  return null;
}

/** Rejects internally inconsistent successful prepay bodies before any wallet work begins. */
function prepayResponseMatches(prepay: LoanPrepay, loan: MyLoan, amountText: string): boolean {
  const rows = [...prepay.bills, ...prepay.waiting];
  const responseSats = BigInt(prepay.amountSats);
  const billedSats = prepay.bills.reduce((sum, row) => sum + BigInt(row.amountSats), 0n);
  if (billedSats !== responseSats) {
    return false;
  }
  const requested = parseLoanAmount(amountText, loan.goalCurrency);
  if (requested === null) {
    return false;
  }
  if (loan.goalCurrency === 'BTC') {
    const allocatedSats = rows.reduce((sum, row) => sum + BigInt(row.amountSats), 0n);
    return requested.units === allocatedSats;
  }
  let distributedCents = 0n;
  for (const row of rows) {
    if (row.amount === null) {
      return false;
    }
    const cents = creditSmallestUnits(row.amount, false);
    if (cents === null) {
      return false;
    }
    distributedCents += cents;
  }
  return distributedCents === requested.units;
}

/** Orders bills by repayment day, loan order, then api order. */
function orderBills(
  perLoan: readonly { messageId: string; bills: readonly RepaymentBill[] }[],
): OrderedBill[] {
  return perLoan
    .flatMap((loan, loanIndex) =>
      loan.bills.map((bill, billIndex) => ({
        ...bill,
        messageId: loan.messageId,
        loanIndex,
        billIndex,
      })),
    )
    .sort(
      (left, right) =>
        left.dayIndex - right.dayIndex ||
        left.loanIndex - right.loanIndex ||
        left.billIndex - right.billIndex,
    )
    .map(({ loanIndex: _loanIndex, billIndex: _billIndex, ...bill }) => bill);
}

/** Spark invoice, or the payment request when the api did not issue one. */
function invoiceInput(bill: Pick<RepaymentBill, 'sparkInvoice' | 'pr'>): string {
  return bill.sparkInvoice ?? bill.pr;
}

/** Share identity that stays stable when `/due` rotates the invoice. */
function shareKey(
  bill: Pick<OrderedBill, 'messageId' | 'dayIndex' | 'recipientAccountId'>,
): string {
  return `${bill.messageId}:${bill.dayIndex}:${bill.recipientAccountId}`;
}

interface PreparedBill {
  bill: OrderedBill;
  feeSats: number;
  send: () => Promise<WalletSendResult>;
}

interface SettlementTarget {
  before: number;
  sent: number;
}

interface SendRun {
  sentSats: number;
  sentAmounts: { code: MyLoan['goalCurrency']; amount: string | null }[];
  feeSats: number;
  names: string[];
  seenNames: Set<string>;
  shares: { messageId: string; key: string }[];
  targets: Map<string, SettlementTarget>;
  failed: boolean;
  latePending: boolean;
  timedOut: boolean;
  lastSendAt: number;
  skippedAtSend: boolean;
}

type PinnedLoanRepay = Pick<
  LoanRepayResult,
  | 'phase'
  | 'activeAction'
  | 'balanceSats'
  | 'sentSats'
  | 'sentAmounts'
  | 'sentNames'
  | 'prepayWaiting'
  | 'prepayMessageId'
  | 'feeSats'
  | 'missingSats'
  | 'errorKey'
  | 'actionError'
  | 'topUpOpen'
>;

const PIN_BASE = {
  activeAction: null as LoanRepayActiveAction | null,
  sentSats: 0,
  sentAmounts: [] as { code: MyLoan['goalCurrency']; amount: string | null }[],
  sentNames: [] as string[],
  prepayWaiting: [] as RepaymentWaiting[],
  prepayMessageId: null,
  feeSats: 0,
  missingSats: null,
  errorKey: null,
  actionError: null,
  topUpOpen: false,
};
const PIN_DUE_ACTION: LoanRepayActiveAction = { kind: 'due', messageId: null };

/** Playwright-only repayment states; completed pins carry the amount and recipients sent. */
const PINNED_RESULTS: Record<string, PinnedLoanRepay> = {
  'repay-ready': { ...PIN_BASE, phase: 'idle', balanceSats: 21_000 },
  'repay-connecting': { ...PIN_BASE, phase: 'connecting', balanceSats: null },
  'repay-setup-failed': { ...PIN_BASE, phase: 'setupFailed', balanceSats: null },
  'repay-short': { ...PIN_BASE, phase: 'idle', balanceSats: 600 },
  'repay-fee-gap': {
    ...PIN_BASE,
    phase: 'idle',
    balanceSats: 1_000,
    activeAction: PIN_DUE_ACTION,
    missingSats: 25,
  },
  'repay-fee-gap-topup': {
    ...PIN_BASE,
    phase: 'idle',
    balanceSats: 1_000,
    activeAction: PIN_DUE_ACTION,
    missingSats: 25,
    topUpOpen: true,
  },
  'repay-topup': { ...PIN_BASE, phase: 'idle', balanceSats: 600, topUpOpen: true },
  'repay-sending': {
    ...PIN_BASE,
    phase: 'sending',
    balanceSats: 21_000,
    activeAction: PIN_DUE_ACTION,
  },
  'repay-partial': {
    ...PIN_BASE,
    phase: 'idle',
    balanceSats: 21_000,
    activeAction: PIN_DUE_ACTION,
    sentSats: 500,
    sentNames: ['Bruno'],
  },
  'repay-repaid': {
    ...PIN_BASE,
    phase: 'repaid',
    balanceSats: 21_000,
    activeAction: PIN_DUE_ACTION,
    sentSats: 1_000,
    sentNames: ['Bruno', 'Carla', 'Diego'],
  },
  'repay-repaid-multi': {
    ...PIN_BASE,
    phase: 'repaid',
    balanceSats: 21_000,
    activeAction: PIN_DUE_ACTION,
    sentSats: 2_200,
    sentNames: ['Bruno', 'Carla', 'Diego', 'Elena', 'Farid'],
  },
  'repay-unconfirmed': {
    ...PIN_BASE,
    phase: 'unconfirmed',
    balanceSats: 21_000,
    activeAction: PIN_DUE_ACTION,
  },
  'repay-failed': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: PIN_DUE_ACTION,
    errorKey: 'forum.payErrorRequest',
  },
  'repay-failed-cannot-receive': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: PIN_DUE_ACTION,
    errorKey: 'loans.errorCannotReceive',
  },
  'repay-pay-more-server-max': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'amount_too_high',
      maxSats: 6_000,
      maxAmount: null,
    },
  },
  'repay-pay-more-server-invalid': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'invalid_amount',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-pay-more-error': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'payment_open',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-pay-more-rate-limit': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'rate_limited',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-pay-more-service-unavailable': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'service_unavailable',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-pay-more-missing-requirements': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'missing_requirements',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-pay-more-request-failure': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'request_failed',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-pay-more-wallet-failure': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    errorKey: 'forum.payErrorRequest',
  },
  'repay-pay-more-cannot-receive': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    errorKey: 'loans.errorCannotReceive',
  },
  'repay-pay-more-api-sunday': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'sunday_rest',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-pay-more-nothing-due': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'nothing_due',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-pay-more-sending': {
    ...PIN_BASE,
    phase: 'sending',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
  },
  'repay-pay-more-waiting': {
    ...PIN_BASE,
    phase: 'waiting',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    prepayWaiting: [
      {
        dayIndex: 12,
        recipientAccountId: 'acc_carla',
        name: 'Carla',
        username: 'carla',
        amountSats: 200,
        amount: null,
      },
    ],
    prepayMessageId: 'loan-a',
  },
  'repay-pay-more-all-waiting': {
    ...PIN_BASE,
    phase: 'repaid',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    prepayWaiting: [
      {
        dayIndex: 12,
        recipientAccountId: 'acc_carla',
        name: 'Carla',
        username: 'carla',
        amountSats: 200,
        amount: null,
      },
    ],
    prepayMessageId: 'loan-a',
  },
  'repay-pay-more-unconfirmed': {
    ...PIN_BASE,
    phase: 'unconfirmed',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
  },
  'repay-pay-more-success': {
    ...PIN_BASE,
    phase: 'repaid',
    balanceSats: 21_000,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    sentSats: 1_000,
    sentNames: ['Bruno', 'Carla', 'Diego'],
  },
  'repay-pay-more-shortfall': {
    ...PIN_BASE,
    phase: 'idle',
    balanceSats: 500,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    missingSats: 500,
    topUpOpen: true,
  },
  'repay-pay-more-shortfall-collapsed': {
    ...PIN_BASE,
    phase: 'idle',
    balanceSats: 500,
    activeAction: { kind: 'prepay', messageId: 'loan-a' },
    missingSats: 500,
    topUpOpen: false,
  },
  'repay-close-sending': {
    ...PIN_BASE,
    phase: 'sending',
    balanceSats: 21_000,
    activeAction: { kind: 'close', messageId: 'loan-a' },
  },
  'repay-close-error': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'close', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'request_failed',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-close-rate-limit': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'close', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'rate_limited',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-close-service-unavailable': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'close', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'service_unavailable',
      maxSats: null,
      maxAmount: null,
    },
  },
  'repay-close-missing-requirements': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    activeAction: { kind: 'close', messageId: 'loan-a' },
    actionError: {
      messageId: 'loan-a',
      code: 'missing_requirements',
      maxSats: null,
      maxAmount: null,
    },
  },
};

/** Shares reserved from the start of their send until failure or confirmed settlement. */
const reservedShares = new Set<string>();

/**
 * Runs the all-loans repayment flow and waits for api settlement. A share is
 * reserved from the moment its send starts; a send that did not go out
 * releases it. Confirmed settlement also releases every share whose loan's
 * `repaidSats` reached the run's target, so a remaining part of that share can
 * be paid later. Timed-out or otherwise unsettled sends stay reserved. The
 * named shares are taken from all due shares, or from the
 * optional `onlyShares` keys when given; shares of that set another run
 * already holds are skipped. While a share remains reserved, a new invoice
 * for it is not prepared or sent; when every named share is reserved the run
 * ends unconfirmed. When `onlyShares` is given and none of those shares are
 * still due, the run reloads, then ends `unconfirmed` if one of the named
 * shares is held by another run, `repaid` if nothing is due any more, otherwise
 * `idle`; a run that sends nothing and whose reload fails ends `failed` instead
 * (`forum.payErrorRequest`). The send-now link names at most 60 shares per loan (one due request's
 * limit); if any named share is missing from the due answer, nothing is sent
 * and the screen reloads. After every due request the run reloads loans for a
 * fresh `repaidSats` baseline. Without a fresh body, or when any loan this run
 * would pay is missing from that body, it prepares nothing, sends nothing, and
 * ends `failed`. A loan with no bills in this run may be absent without effect.
 * Tap-time `repaidSats` is kept for skipped-share settlement (`extraSkipped`).
 * A share another run is sending is skipped; if that
 * leaves nothing sent the run ends unconfirmed.
 * A skipped share still counts toward the settlement of its loan; a reserved
 * share already counted in the fresh baseline is not required again.
 * Every prepare or send that does not pay (also `insufficient`, and a prepared
 * amount other than the bill, as `amount_mismatch`) is reported with
 * {@link reportPaymentFailure} under the flow `repay`; a send also after the
 * screen closed, a prepare only while its run is current.
 *
 * @param options - Supplies the loans reload used by the post-due baseline and
 *   settlement polling.
 * @returns Wallet availability, run totals, top-up state, and repayment actions.
 */
export function useLoanRepay(options: {
  /** Reload from useMyLoans; used for the post-due baseline and the settlement poll. */
  reload: () => Promise<MyLoans | null>;
}): LoanRepayResult {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const status = useWalletStore((state) => state.status);
  const storeBalance = useWalletStore((state) => state.balanceSats);
  const setupFailed = useWalletSetup().failed;
  const [livePhase, setLivePhase] = useState<LivePhase>('idle');
  const [activeAction, setActiveAction] = useState<LoanRepayActiveAction | null>(null);
  const [sentSats, setSentSats] = useState(0);
  const [sentAmounts, setSentAmounts] = useState<
    { code: MyLoan['goalCurrency']; amount: string | null }[]
  >([]);
  const [sentNames, setSentNames] = useState<string[]>([]);
  const [prepayWaiting, setPrepayWaiting] = useState<RepaymentWaiting[]>([]);
  const [prepayMessageId, setPrepayMessageId] = useState<string | null>(null);
  const [feeSats, setFeeSats] = useState(0);
  const [missingSats, setMissingSats] = useState<number | null>(null);
  const missingBalance = useRef<number | null | undefined>(undefined);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [actionError, setActionError] = useState<LoanRepayActionError | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const generation = useRef(0);
  const actionPending = useRef(false);
  const phaseRef = useRef<LoanRepayPhase>('connecting');
  const settlementInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settlementReading = useRef(false);
  const pinName = visualPin();
  const pinnedResult = pinName === null ? undefined : PINNED_RESULTS[pinName];
  const pinned = pinnedResult !== undefined;
  const behaviorWallet = pinName === 'repay-e2e-payment';
  const usable = behaviorWallet || (status !== 'disabled' && canUnlockWallet(account));
  const setupDue = needsWalletSetup(account);
  const balanceSats = behaviorWallet ? 21_000 : status === 'ready' ? storeBalance : null;

  const clearSettlement = useCallback((): void => {
    if (settlementInterval.current !== null) {
      clearInterval(settlementInterval.current);
      settlementInterval.current = null;
    }
    if (confirmationTimer.current !== null) {
      clearTimeout(confirmationTimer.current);
      confirmationTimer.current = null;
    }
    settlementReading.current = false;
  }, []);

  const setPaymentPhase = useCallback((next: LivePhase): void => {
    actionPending.current = ACTIVE_RUN_PHASES.has(next);
    phaseRef.current = next;
    setLivePhase(next);
  }, []);

  useEffect(() => {
    generation.current += 1;
    actionPending.current = false;
    clearSettlement();
    setLivePhase('idle');
    setActiveAction(null);
    setSentSats(0);
    setSentAmounts([]);
    setSentNames([]);
    setPrepayWaiting([]);
    setPrepayMessageId(null);
    setFeeSats(0);
    missingBalance.current = undefined;
    setMissingSats(null);
    setErrorKey(null);
    setActionError(null);
    setTopUpOpen(false);
    return () => {
      generation.current += 1;
      clearSettlement();
    };
  }, [session, pinned, clearSettlement]);

  useEffect(() => {
    if (missingBalance.current !== undefined && missingBalance.current !== storeBalance) {
      missingBalance.current = undefined;
      setMissingSats(null);
    }
  }, [storeBalance]);

  useEffect(() => {
    if (!topUpOpen || pinned || status !== 'ready') {
      return;
    }
    let reading = false;
    const poll = setInterval(() => {
      if (reading) {
        return;
      }
      reading = true;
      void refreshWallet({ ensureSynced: true, ignoreFailure: true }).finally(() => {
        reading = false;
      });
    }, WALLET_PAY_BALANCE_POLL_MS);
    return () => {
      clearInterval(poll);
    };
  }, [topUpOpen, pinned, status]);

  let phase: LoanRepayPhase;
  if (behaviorWallet || actionPending.current) {
    phase = livePhase;
  } else if (!usable) {
    phase = 'unavailable';
  } else if (setupDue && setupFailed) {
    phase = 'setupFailed';
  } else if (setupDue || status !== 'ready') {
    phase = 'connecting';
  } else {
    phase = livePhase;
  }
  phaseRef.current = pinnedResult?.phase ?? phase;

  const openTopUp = useCallback((): void => {
    if (!pinned) {
      setTopUpOpen(true);
    }
  }, [pinned]);

  const runPayment = useCallback(
    (
      loans: readonly MyLoan[],
      onlyShares?: ReadonlySet<string>,
      shareAmounts?: ReadonlyMap<string, string | null>,
      prepayRequest?: { messageId: string; amountText: string },
    ): void => {
      const allowed = new Set<LoanRepayPhase>(['idle', 'failed', 'repaid', 'unconfirmed']);
      const session = useAuthStore.getState().session;
      if (pinned || actionPending.current || !allowed.has(phaseRef.current) || session === null) {
        return;
      }

      const run = ++generation.current;
      const active = (): boolean => run === generation.current;
      clearSettlement();
      setPaymentPhase('preparing');
      setActiveAction(
        prepayRequest === undefined
          ? { kind: 'due', messageId: null }
          : { kind: 'prepay', messageId: prepayRequest.messageId },
      );
      setSentSats(0);
      setSentAmounts([]);
      setSentNames([]);
      setPrepayWaiting([]);
      setPrepayMessageId(null);
      setFeeSats(0);
      missingBalance.current = undefined;
      setMissingSats(null);
      setErrorKey(null);
      setActionError(null);
      const failBeforeSend = (
        error: unknown,
        untypedRequestMessageId: string | null = null,
      ): void => {
        if (!active()) {
          return;
        }
        const key: ErrorKey =
          error instanceof WalletRequiredError
            ? 'wallet.payUnavailable'
            : error instanceof CannotReceiveError
              ? 'loans.errorCannotReceive'
              : error instanceof Error && /too many (messages|payments)/i.test(error.message)
                ? 'forum.payErrorRateLimit'
                : 'forum.payErrorRequest';
        const typedActionError =
          prepayRequest === undefined ? null : actionErrorOf(error, prepayRequest.messageId);
        setErrorKey(key);
        setActionError(
          typedActionError ??
            (untypedRequestMessageId !== null && key === 'forum.payErrorRequest'
              ? {
                  messageId: untypedRequestMessageId,
                  code: 'request_failed',
                  maxSats: null,
                  maxAmount: null,
                }
              : null),
        );
        setPaymentPhase('failed');
      };

      void (async (): Promise<void> => {
        const currencyByMessage = new Map(loans.map((loan) => [loan.messageId, loan.goalCurrency]));
        const perLoan: Array<{ messageId: string; bills: readonly RepaymentBill[] }> = [];
        try {
          if (prepayRequest !== undefined) {
            const prepay = await prepayLoan(
              session,
              prepayRequest.messageId,
              prepayRequest.amountText,
            );
            if (!active()) {
              return;
            }
            if (!prepayResponseMatches(prepay, loans[0]!, prepayRequest.amountText)) {
              throw new Error('Inconsistent prepay response');
            }
            setPrepayWaiting(prepay.waiting);
            setPrepayMessageId(prepayRequest.messageId);
            perLoan.push({ messageId: prepayRequest.messageId, bills: prepay.bills });
          } else {
            for (const loan of loans) {
              if (loan.due.payableSats === null || loan.due.payableSats <= 0) {
                continue;
              }
              const due = await postRepaymentDue(session, loan.messageId);
              if (!active()) {
                return;
              }
              perLoan.push({ messageId: loan.messageId, bills: due.bills });
            }
          }
        } catch (error: unknown) {
          failBeforeSend(error, prepayRequest?.messageId ?? null);
          return;
        }

        const ordered = orderBills(perLoan);
        const named =
          onlyShares === undefined
            ? ordered
            : ordered.filter((bill) => onlyShares.has(shareKey(bill)));
        const bills = named.filter((bill) => !reservedShares.has(shareKey(bill)));
        const skipped = bills.length !== named.length;
        const skippedByMessage = new Map<string, number>();
        for (const bill of named) {
          if (reservedShares.has(shareKey(bill))) {
            skippedByMessage.set(
              bill.messageId,
              (skippedByMessage.get(bill.messageId) ?? 0) + bill.amountSats,
            );
          }
        }
        const dueKeys = new Set(ordered.map((bill) => shareKey(bill)));
        const namedMissing =
          onlyShares !== undefined &&
          [...onlyShares].some((key) => !reservedShares.has(key) && !dueKeys.has(key));
        if (namedMissing || bills.length === 0) {
          const reloaded = await options.reload();
          if (!active()) {
            return;
          }
          // Nothing was sent, but the screen cannot show where the loans stand: say so.
          if (reloaded === null) {
            failBeforeSend(new Error('reload'));
            return;
          }
          if (!namedMissing && skipped) {
            setPaymentPhase('unconfirmed');
            return;
          }
          if (ordered.length === 0) {
            setTopUpOpen(false);
            setPaymentPhase('repaid');
            return;
          }
          setPaymentPhase('idle');
          return;
        }

        const tapByMessage = new Map(loans.map((loan) => [loan.messageId, loan.repaidSats]));
        const fresh = await options.reload();
        if (!active()) {
          return;
        }
        const runMessageIds = new Set(bills.map((bill) => bill.messageId));
        if (
          fresh === null ||
          [...runMessageIds].some(
            (messageId) => !fresh.loans.some((row) => row.messageId === messageId),
          )
        ) {
          failBeforeSend(new Error('baseline'));
          return;
        }
        const beforeByMessage = new Map<string, number>();
        for (const row of fresh.loans) {
          if (runMessageIds.has(row.messageId)) {
            beforeByMessage.set(row.messageId, row.repaidSats);
          }
        }
        const extraSkipped = (messageId: string): number => {
          const skipped = skippedByMessage.get(messageId) ?? 0;
          const before = beforeByMessage.get(messageId)!;
          const tapRepaid = tapByMessage.get(messageId)!;
          return Math.max(0, skipped - Math.max(0, before - tapRepaid));
        };

        const prepared: PreparedBill[] = [];
        let insufficient = false;
        let insufficientFeeSats = 0;
        for (const bill of bills) {
          const result = await payFromWallet({
            type: 'input',
            input: invoiceInput(bill),
          });
          if (!active()) {
            return;
          }
          if (result.kind !== 'confirm') {
            reportPaymentFailure({ ...result.failure, amountSats: bill.amountSats }, 'repay', {
              session,
            });
            if (result.kind === 'insufficient') {
              insufficient = true;
              insufficientFeeSats = result.feeSats ?? 0;
              break;
            }
            failBeforeSend(new Error('prepare'));
            return;
          }
          if (result.amountSats !== bill.amountSats) {
            reportPaymentFailure(
              {
                stage: 'prepare',
                reason: 'amount_mismatch',
                method: result.method,
                amountSats: bill.amountSats,
                feeSats: result.feeSats,
              },
              'repay',
              { session },
            );
            failBeforeSend(new Error('prepare'));
            return;
          }
          prepared.push({ bill, feeSats: result.feeSats, send: result.send });
        }

        const currentBalance = behaviorWallet
          ? 21_000
          : (useWalletStore.getState().balanceSats ?? 0);
        const knownTotal = prepared.reduce(
          (sum, item) => sum + item.bill.amountSats + item.feeSats,
          0,
        );
        const allTotal =
          bills.reduce((sum, bill) => sum + bill.amountSats, 0) +
          prepared.reduce((sum, item) => sum + item.feeSats, 0) +
          insufficientFeeSats;
        const kept = prepared;
        if (kept.length === 0 || insufficient || knownTotal > currentBalance) {
          missingBalance.current = useWalletStore.getState().balanceSats;
          setMissingSats(Math.max(1, allTotal - currentBalance));
          setPaymentPhase('idle');
          return;
        }

        setTopUpOpen(false);
        setPaymentPhase('sending');
        const sent: SendRun = {
          sentSats: 0,
          sentAmounts: [],
          feeSats: 0,
          names: [],
          seenNames: new Set<string>(),
          shares: [],
          targets: new Map<string, SettlementTarget>(),
          failed: false,
          latePending: false,
          timedOut: false,
          lastSendAt: Date.now(),
          skippedAtSend: false,
        };

        const publishSent = (): void => {
          setSentSats(sent.sentSats);
          setSentAmounts([...sent.sentAmounts]);
          setFeeSats(sent.feeSats);
          setSentNames([...sent.names]);
        };
        const countSent = (item: PreparedBill): void => {
          sent.sentSats += item.bill.amountSats;
          const amount = item.bill.amount ?? shareAmounts?.get(shareKey(item.bill)) ?? null;
          sent.sentAmounts.push({
            // Every bill comes from a loan in `loans`, which supplied its currency above.
            code: currencyByMessage.get(item.bill.messageId)!,
            amount,
          });
          sent.feeSats += item.feeSats;
          if (!sent.seenNames.has(item.bill.name)) {
            sent.seenNames.add(item.bill.name);
            sent.names.push(item.bill.name);
          }
          sent.shares.push({ messageId: item.bill.messageId, key: shareKey(item.bill) });
          const target = sent.targets.get(item.bill.messageId);
          if (target === undefined) {
            sent.targets.set(item.bill.messageId, {
              before: beforeByMessage.get(item.bill.messageId)!,
              sent: item.bill.amountSats + extraSkipped(item.bill.messageId),
            });
          } else {
            target.sent += item.bill.amountSats;
          }
          publishSent();
        };
        const settled = (fresh: MyLoans): boolean => {
          const settledMessages = new Set(
            [...sent.targets]
              .filter(([messageId, target]) => {
                const loan = fresh.loans.find((row) => row.messageId === messageId);
                return loan === undefined || loan.repaidSats >= target.before + target.sent;
              })
              .map(([messageId]) => messageId),
          );
          for (const share of sent.shares) {
            if (settledMessages.has(share.messageId)) {
              reservedShares.delete(share.key);
            }
          }
          return settledMessages.size === sent.targets.size;
        };

        const startSettlement = (): void => {
          const remaining = WALLET_PAY_CONFIRM_WAIT_MS - (Date.now() - sent.lastSendAt);
          if (remaining <= 0) {
            sent.timedOut = true;
            clearSettlement();
            setPaymentPhase('unconfirmed');
            return;
          }
          setPaymentPhase('waiting');
          if (settlementInterval.current === null) {
            settlementInterval.current = setInterval(() => {
              if (
                settlementReading.current ||
                /* v8 ignore next 1 -- Generation changes synchronously clear the interval. */
                !active()
              ) {
                return;
              }
              settlementReading.current = true;
              void options
                .reload()
                .then((fresh) => {
                  if (
                    active() &&
                    fresh !== null &&
                    !sent.latePending &&
                    !sent.timedOut &&
                    settled(fresh)
                  ) {
                    clearSettlement();
                    setPaymentPhase(sent.failed ? 'failed' : 'repaid');
                  }
                })
                .finally(() => {
                  settlementReading.current = false;
                });
            }, WALLET_PAY_BALANCE_POLL_MS);
          }
          if (confirmationTimer.current === null) {
            confirmationTimer.current = setTimeout(() => {
              confirmationTimer.current = null;
              /* v8 ignore next 3 -- Generation changes synchronously clear the timer. */
              if (!active()) {
                return;
              }
              sent.timedOut = true;
              if (settlementInterval.current !== null) {
                clearInterval(settlementInterval.current);
                settlementInterval.current = null;
              }
              setPaymentPhase('unconfirmed');
            }, remaining);
          }
        };
        const finishSending = (): void => {
          /* v8 ignore next 3 -- Every call site checks active without yielding first. */
          if (!active()) {
            return;
          }
          if (sent.sentSats > 0 || sent.latePending) {
            startSettlement();
          } else if (sent.failed) {
            clearSettlement();
            setPaymentPhase('failed');
          } else if (sent.skippedAtSend) {
            clearSettlement();
            setPaymentPhase('unconfirmed');
          }
        };

        for (const [index, item] of kept.entries()) {
          const share = shareKey(item.bill);
          if (reservedShares.has(share)) {
            sent.skippedAtSend = true;
            const target = sent.targets.get(item.bill.messageId);
            if (target !== undefined) {
              target.sent += item.bill.amountSats;
            } else {
              skippedByMessage.set(
                item.bill.messageId,
                (skippedByMessage.get(item.bill.messageId) ?? 0) + item.bill.amountSats,
              );
            }
            continue;
          }
          reservedShares.add(share);
          const result = await item.send();
          if (result.kind === 'failed' && result.sentLate !== undefined) {
            void result.sentLate.then((wasSent) => {
              if (!wasSent) {
                reservedShares.delete(share);
              }
            });
          } else if (result.kind !== 'paid') {
            reservedShares.delete(share);
          }
          if (result.kind !== 'paid') {
            const sentLate = result.kind === 'failed' ? result.sentLate : undefined;
            reportPaymentFailure({ ...result.failure, amountSats: item.bill.amountSats }, 'repay', {
              session,
              sentLate,
            });
          }
          if (!active()) {
            return;
          }
          sent.lastSendAt = Date.now();
          if (result.kind === 'paid') {
            countSent(item);
            continue;
          }
          setErrorKey('forum.payErrorRequest');
          if (result.kind === 'insufficient') {
            sent.failed = true;
            const remainingCost = kept
              .slice(index)
              .reduce((sum, row) => sum + row.bill.amountSats + row.feeSats, 0);
            const rawBalance = useWalletStore.getState().balanceSats;
            const balance = rawBalance ?? 0;
            missingBalance.current = rawBalance;
            setMissingSats(Math.max(0, remainingCost - balance));
          } else if (result.kind === 'failed' && result.sentLate !== undefined) {
            sent.latePending = true;
            void result.sentLate.then((wasSent) => {
              if (!active()) {
                return;
              }
              sent.latePending = false;
              if (wasSent) {
                countSent(item);
              } else {
                sent.failed = true;
              }
              finishSending();
            });
          } else {
            sent.failed = true;
          }
          break;
        }
        finishSending();
      })();
    },
    [behaviorWallet, clearSettlement, options, pinned, setPaymentPhase],
  );

  const pay = useCallback(
    (
      loans: readonly MyLoan[],
      onlyShares?: ReadonlySet<string>,
      shareAmounts?: ReadonlyMap<string, string | null>,
    ): void => {
      runPayment(loans, onlyShares, shareAmounts);
    },
    [runPayment],
  );

  const prepay = useCallback(
    (loan: MyLoan, amountText: string): void => {
      runPayment([loan], undefined, undefined, { messageId: loan.messageId, amountText });
    },
    [runPayment],
  );

  const closeCollecting = useCallback(
    (loan: MyLoan): void => {
      const session = useAuthStore.getState().session;
      if (
        pinned ||
        session === null ||
        loan.fundedAt !== null ||
        (loan.closedAt !== null && loan.closedAt !== undefined) ||
        actionPending.current
      ) {
        return;
      }
      const run = ++generation.current;
      clearSettlement();
      setPaymentPhase('preparing');
      setActiveAction({ kind: 'close', messageId: loan.messageId });
      setErrorKey(null);
      setActionError(null);
      void (async (): Promise<void> => {
        try {
          await closeLoan(session, loan.messageId);
          if (run !== generation.current) {
            return;
          }
          const fresh = await options.reload();
          if (run !== generation.current) {
            return;
          }
          if (fresh === null) {
            throw new Error('reload');
          }
          setActiveAction(null);
          setPaymentPhase('idle');
        } catch (error: unknown) {
          if (run !== generation.current) {
            return;
          }
          const typed = actionErrorOf(error, loan.messageId) ?? {
            messageId: loan.messageId,
            code: 'request_failed' as const,
            maxSats: null,
            maxAmount: null,
          };
          setActionError(typed);
          setErrorKey(
            typed?.code === 'rate_limited' ? 'forum.payErrorRateLimit' : 'forum.payErrorRequest',
          );
          setPaymentPhase('failed');
        }
      })();
    },
    [clearSettlement, options, pinned, setPaymentPhase],
  );

  if (pinnedResult !== undefined) {
    return { ...pinnedResult, openTopUp, pay, prepay, closeCollecting, pinned: true };
  }
  return {
    phase,
    activeAction,
    balanceSats,
    sentSats,
    sentAmounts,
    sentNames,
    prepayWaiting,
    prepayMessageId,
    feeSats,
    missingSats,
    errorKey: phase === 'failed' ? errorKey : null,
    actionError,
    topUpOpen,
    openTopUp,
    pay,
    prepay,
    closeCollecting,
    pinned: false,
  };
}
