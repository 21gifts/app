'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WALLET_PAY_BALANCE_POLL_MS, WALLET_PAY_CONFIRM_WAIT_MS } from '@/hooks/useWalletPay';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import {
  postRepaymentDue,
  WalletRequiredError,
  type MyLoan,
  type MyLoans,
  type RepaymentBill,
} from '@/lib/api';
import { fittingPrefix } from '@/lib/loan-repay';
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
 * - failed: the due request or a prepare failed before anything was sent (`errorKey` says why),
 *   or a send failed (then `sent` lists what did go out).
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
  /** Wallet balance in whole sats while the wallet is ready, else null. */
  balanceSats: number | null;
  /** Sats of bills that went out in the last run (0 before any). */
  sentSats: number;
  /** Names of the recipients paid in the last run, in pay order, without duplicates. */
  sentNames: string[];
  /** Sum of prepared fees of the bills that went out (0 when none). */
  feeSats: number;
  /**
   * Set when a run stopped because the balance did not cover amount + fees of what it tried:
   * amount + fees − balance, in sats. Null otherwise.
   */
  missingSats: number | null;
  /**
   * Catalog key of the failure line while phase is 'failed':
   * 'forum.payErrorRateLimit' | 'forum.payErrorRequest' | 'wallet.payUnavailable'.
   */
  errorKey: 'forum.payErrorRateLimit' | 'forum.payErrorRequest' | 'wallet.payUnavailable' | null;
  /** True while the top-up block is open. */
  topUpOpen: boolean;
  /** Opens the top-up block (the screen's "Top up your wallet"); starts the balance poll. */
  openTopUp: () => void;
  /**
   * One tap: pays every payable bill of `loans` (all loans with due.payableSats \> 0).
   * `limitSats` (optional): pay only the fitting prefix of the ordered bills whose amount
   * stays ≤ limitSats (the "send ₿C now" link passes the named prefix total). The named
   * prefix is taken from all due shares; shares of it another run already holds are
   * skipped. Only that named prefix is prepared. The whole prefix is sent, or nothing: an
   * `insufficient` prepare in the prefix, or a total that does not fit the current
   * balance, sends nothing.
   *
   * @param loans - Current loans body in list order.
   * @param limitSats - Optional amount-only budget for a leading subset; only that named
   *   prefix is prepared. An insufficient prepare in the prefix, or fees that do not fit
   *   the balance, send nothing.
   */
  pay: (loans: readonly MyLoan[], limitSats?: number) => void;
  /** True while a `repay-*` visual pin, including its fixed sent totals, applies. */
  pinned: boolean;
}

type LivePhase = 'idle' | 'preparing' | 'sending' | 'waiting' | 'repaid' | 'unconfirmed' | 'failed';
type ErrorKey = Exclude<LoanRepayResult['errorKey'], null>;
type OrderedBill = RepaymentBill & { messageId: string };

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
  feeSats: number;
  names: string[];
  seenNames: Set<string>;
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
  | 'balanceSats'
  | 'sentSats'
  | 'sentNames'
  | 'feeSats'
  | 'missingSats'
  | 'errorKey'
  | 'topUpOpen'
>;

const PIN_BASE = {
  sentSats: 0,
  sentNames: [] as string[],
  feeSats: 0,
  missingSats: null,
  errorKey: null,
  topUpOpen: false,
};

/** Playwright-only repayment states; completed pins carry the amount and recipients sent. */
const PINNED_RESULTS: Record<string, PinnedLoanRepay> = {
  'repay-ready': { ...PIN_BASE, phase: 'idle', balanceSats: 21_000 },
  'repay-connecting': { ...PIN_BASE, phase: 'connecting', balanceSats: null },
  'repay-setup-failed': { ...PIN_BASE, phase: 'setupFailed', balanceSats: null },
  'repay-short': { ...PIN_BASE, phase: 'idle', balanceSats: 600 },
  'repay-fee-gap': { ...PIN_BASE, phase: 'idle', balanceSats: 1_000, missingSats: 25 },
  'repay-fee-gap-topup': {
    ...PIN_BASE,
    phase: 'idle',
    balanceSats: 1_000,
    missingSats: 25,
    topUpOpen: true,
  },
  'repay-topup': { ...PIN_BASE, phase: 'idle', balanceSats: 600, topUpOpen: true },
  'repay-sending': { ...PIN_BASE, phase: 'sending', balanceSats: 21_000 },
  'repay-partial': {
    ...PIN_BASE,
    phase: 'idle',
    balanceSats: 21_000,
    sentSats: 500,
    sentNames: ['Bruno'],
  },
  'repay-repaid': {
    ...PIN_BASE,
    phase: 'repaid',
    balanceSats: 21_000,
    sentSats: 1_000,
    sentNames: ['Bruno', 'Carla', 'Diego'],
  },
  'repay-repaid-multi': {
    ...PIN_BASE,
    phase: 'repaid',
    balanceSats: 21_000,
    sentSats: 2_200,
    sentNames: ['Bruno', 'Carla', 'Diego', 'Elena', 'Farid'],
  },
  'repay-unconfirmed': { ...PIN_BASE, phase: 'unconfirmed', balanceSats: 21_000 },
  'repay-failed': {
    ...PIN_BASE,
    phase: 'failed',
    balanceSats: 21_000,
    errorKey: 'forum.payErrorRequest',
  },
};

/** Shares reserved from the start of their send until it is known they did not go out. */
const reservedShares = new Set<string>();

/**
 * Runs the all-loans repayment flow and waits for api settlement. A share is
 * reserved from the moment its send starts; a send that did not go out
 * releases it. The named prefix is taken from all due shares; shares of it
 * another run already holds are skipped. A reserved share is never prepared
 * or sent again in this app session, including when `/due` later returns a
 * new invoice for that share; when every named share is reserved the run
 * ends unconfirmed. A share another run is sending is skipped; if that
 * leaves nothing sent the run ends unconfirmed. A skipped share still counts
 * toward the settlement of its loan; a reserved share already counted in the
 * fresh baseline is not required again.
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
  const [sentSats, setSentSats] = useState(0);
  const [sentNames, setSentNames] = useState<string[]>([]);
  const [feeSats, setFeeSats] = useState(0);
  const [missingSats, setMissingSats] = useState<number | null>(null);
  const missingBalance = useRef<number | null | undefined>(undefined);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const generation = useRef(0);
  const phaseRef = useRef<LoanRepayPhase>('connecting');
  const settlementInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settlementReading = useRef(false);
  const pinName = visualPin();
  const pinnedResult = pinName === null ? undefined : PINNED_RESULTS[pinName];
  const pinned = pinnedResult !== undefined;
  const usable = status !== 'disabled' && canUnlockWallet(account);
  const setupDue = needsWalletSetup(account);
  const balanceSats = status === 'ready' ? storeBalance : null;

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

  useEffect(() => {
    generation.current += 1;
    clearSettlement();
    setLivePhase('idle');
    setSentSats(0);
    setSentNames([]);
    setFeeSats(0);
    missingBalance.current = undefined;
    setMissingSats(null);
    setErrorKey(null);
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
  if (!usable) {
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

  const pay = useCallback(
    (loans: readonly MyLoan[], limitSats?: number): void => {
      const allowed = new Set<LoanRepayPhase>(['idle', 'failed', 'repaid', 'unconfirmed']);
      const session = useAuthStore.getState().session;
      if (pinned || !allowed.has(phaseRef.current) || session === null) {
        return;
      }

      const run = ++generation.current;
      clearSettlement();
      phaseRef.current = 'preparing';
      setSentSats(0);
      setSentNames([]);
      setFeeSats(0);
      missingBalance.current = undefined;
      setMissingSats(null);
      setErrorKey(null);
      setLivePhase('preparing');

      const active = (): boolean => run === generation.current;
      const failBeforeSend = (error: unknown): void => {
        if (!active()) {
          return;
        }
        const key: ErrorKey =
          error instanceof WalletRequiredError
            ? 'wallet.payUnavailable'
            : error instanceof Error && /too many (messages|payments)/i.test(error.message)
              ? 'forum.payErrorRateLimit'
              : 'forum.payErrorRequest';
        setErrorKey(key);
        setLivePhase('failed');
      };

      void (async (): Promise<void> => {
        const perLoan: Array<{ messageId: string; bills: readonly RepaymentBill[] }> = [];
        try {
          for (const loan of loans) {
            if (loan.due.payableSats <= 0) {
              continue;
            }
            const due = await postRepaymentDue(session, loan.messageId);
            if (!active()) {
              return;
            }
            perLoan.push({ messageId: loan.messageId, bills: due.bills });
          }
        } catch (error: unknown) {
          failBeforeSend(error);
          return;
        }

        const ordered = orderBills(perLoan);
        const named =
          limitSats === undefined
            ? ordered
            : fittingPrefix(ordered, (bill) => bill.amountSats, limitSats);
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
        if (bills.length === 0 && (named.length > 0 || ordered.length === 0)) {
          await options.reload();
          if (!active()) {
            return;
          }
          if (skipped) {
            setLivePhase('unconfirmed');
            return;
          }
          setTopUpOpen(false);
          setLivePhase('repaid');
          return;
        }

        const tapByMessage = new Map(loans.map((loan) => [loan.messageId, loan.repaidSats]));
        const fresh = await options.reload();
        if (!active()) {
          return;
        }
        const beforeByMessage = new Map(tapByMessage);
        if (fresh !== null) {
          for (const row of fresh.loans) {
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

        const currentBalance = useWalletStore.getState().balanceSats ?? 0;
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
          setLivePhase('idle');
          return;
        }

        setTopUpOpen(false);
        setLivePhase('sending');
        const sent: SendRun = {
          sentSats: 0,
          feeSats: 0,
          names: [],
          seenNames: new Set<string>(),
          targets: new Map<string, SettlementTarget>(),
          failed: false,
          latePending: false,
          timedOut: false,
          lastSendAt: Date.now(),
          skippedAtSend: false,
        };

        const publishSent = (): void => {
          setSentSats(sent.sentSats);
          setFeeSats(sent.feeSats);
          setSentNames([...sent.names]);
        };
        const countSent = (item: PreparedBill): void => {
          sent.sentSats += item.bill.amountSats;
          sent.feeSats += item.feeSats;
          if (!sent.seenNames.has(item.bill.name)) {
            sent.seenNames.add(item.bill.name);
            sent.names.push(item.bill.name);
          }
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
        const settled = (fresh: MyLoans): boolean =>
          [...sent.targets].every(([messageId, target]) => {
            const loan = fresh.loans.find((row) => row.messageId === messageId);
            return loan === undefined || loan.repaidSats >= target.before + target.sent;
          });

        const startSettlement = (): void => {
          const remaining = WALLET_PAY_CONFIRM_WAIT_MS - (Date.now() - sent.lastSendAt);
          if (remaining <= 0) {
            sent.timedOut = true;
            clearSettlement();
            setLivePhase('unconfirmed');
            return;
          }
          setLivePhase('waiting');
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
                    setLivePhase(sent.failed ? 'failed' : 'repaid');
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
              setLivePhase('unconfirmed');
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
            setLivePhase('failed');
          } else if (sent.skippedAtSend) {
            clearSettlement();
            setLivePhase('unconfirmed');
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
    [clearSettlement, options, pinned],
  );

  if (pinnedResult !== undefined) {
    return { ...pinnedResult, openTopUp, pay, pinned: true };
  }
  return {
    phase,
    balanceSats,
    sentSats,
    sentNames,
    feeSats,
    missingSats,
    errorKey: phase === 'failed' ? errorKey : null,
    topUpOpen,
    openTopUp,
    pay,
    pinned: false,
  };
}
