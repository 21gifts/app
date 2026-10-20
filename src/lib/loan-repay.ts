import type { MyLoan, MyLoans, RepaymentLedger } from '@/lib/api';

/** Combined state of all of the member's loans, for the loans card, the Menu row and the screen. */
export interface LoansSummary {
  /** Number of loans in the body. */
  count: number;
  /** Loans with `fundedAt !== null`. */
  fundedCount: number;
  /** Sum of goalSats. */
  goalSats: number;
  /** Sum over loans of min(sats, goalSats). */
  sats: number;
  /** Mirrors `sundayRest`. */
  sundayRest: boolean;
  /** Sum of due.payableSats over all loans. */
  payableSats: number;
  /** Sum of due.waitingSats. */
  waitingSats: number;
  /** Sum of due.waitingPeople. */
  waitingPeople: number;
  /** Largest due.behindDays. */
  behindDays: number;
  /** Number of loans with due.payableSats \> 0. */
  payableLoans: number;
  /** True when a loan with payableSats \> 0 has due.lastPayment. */
  lastPayment: boolean;
  /**
   * Earliest next.dueOn among loans whose next is non-null with sats !== null, and the sum of
   * next.sats of every loan whose next.dueOn equals it; null when there is none.
   */
  next: { dueOn: string; sats: number } | null;
  /**
   * Card outline: 'danger' when fundedCount \> 0 and behindDays \> 0; 'success' when fundedCount \> 0,
   * !sundayRest, payableSats === 0 and waitingSats === 0; otherwise 'neutral'.
   */
  tone: 'danger' | 'success' | 'neutral';
  /** The Menu row and the card's Send show: !sundayRest && payableSats \> 0. */
  payable: boolean;
}

/**
 * Combines totals and display state across the member's loans.
 *
 * @param data - Body returned by `GET /me/loans`.
 * @returns Totals, next due day, tone, and payable state.
 */
export function summarizeLoans(data: MyLoans): LoansSummary {
  let fundedCount = 0;
  let goalSats = 0;
  let sats = 0;
  let payableSats = 0;
  let waitingSats = 0;
  let waitingPeople = 0;
  let behindDays = 0;
  let payableLoans = 0;
  let lastPayment = false;
  let next: LoansSummary['next'] = null;

  for (const loan of data.loans) {
    if (loan.fundedAt !== null) {
      fundedCount += 1;
    }
    goalSats += loan.goalSats;
    sats += Math.min(loan.sats, loan.goalSats);
    payableSats += loan.due.payableSats;
    waitingSats += loan.due.waitingSats;
    waitingPeople += loan.due.waitingPeople;
    behindDays = Math.max(behindDays, loan.due.behindDays);
    if (loan.due.payableSats > 0) {
      payableLoans += 1;
      lastPayment ||= loan.due.lastPayment;
    }
    if (loan.next !== null && loan.next.sats !== null) {
      if (next === null || loan.next.dueOn < next.dueOn) {
        next = { dueOn: loan.next.dueOn, sats: loan.next.sats };
      } else if (loan.next.dueOn === next.dueOn) {
        next.sats += loan.next.sats;
      }
    }
  }

  const tone =
    fundedCount > 0 && behindDays > 0
      ? 'danger'
      : fundedCount > 0 && !data.sundayRest && payableSats === 0 && waitingSats === 0
        ? 'success'
        : 'neutral';
  return {
    count: data.loans.length,
    fundedCount,
    goalSats,
    sats,
    sundayRest: data.sundayRest,
    payableSats,
    waitingSats,
    waitingPeople,
    behindDays,
    payableLoans,
    lastPayment,
    next,
    tone,
    payable: !data.sundayRest && payableSats > 0,
  };
}

/** One due share of one loan, oldest first across loans. */
export interface DueShare {
  messageId: string;
  /** Index of the loan in MyLoans.loans (list order). */
  loanIndex: number;
  dayIndex: number;
  dueOn: string | null;
  accountId: string;
  name: string;
  /** row.sats when not null, else row.dueSats; null when neither is known. */
  sats: number | null;
  /** row.amount (loan currency) or null. */
  amount: string | null;
  /** givers[].canReceive of that accountId (true when the giver is not listed). */
  canReceive: boolean;
}

/**
 * Lists every due ledger share in oldest-first order across loans.
 *
 * @param loans - Loans in their `GET /me/loans` list order.
 * @param ledgers - Ledger at the matching loan index, or null when unavailable.
 * @returns Due shares ordered by day, loan, then ledger row.
 */
export function dueShares(
  loans: readonly MyLoan[],
  ledgers: readonly (RepaymentLedger | null)[],
): DueShare[] {
  const rows: Array<DueShare & { rowIndex: number }> = [];
  loans.forEach((loan, loanIndex) => {
    const ledger = ledgers[loanIndex];
    if (ledger === null || ledger === undefined) {
      return;
    }
    const canReceive = new Map(
      ledger.givers.map((giver) => [giver.accountId, giver.canReceive] as const),
    );
    ledger.repayments.forEach((row, rowIndex) => {
      if (row.status !== 'due') {
        return;
      }
      rows.push({
        messageId: loan.messageId,
        loanIndex,
        dayIndex: row.dayIndex,
        dueOn: row.dueOn,
        accountId: row.accountId,
        name: row.name,
        sats: row.sats ?? row.dueSats,
        amount: row.amount,
        canReceive: canReceive.get(row.accountId) ?? true,
        rowIndex,
      });
    });
  });
  return rows
    .sort(
      (left, right) =>
        left.dayIndex - right.dayIndex ||
        left.loanIndex - right.loanIndex ||
        left.rowIndex - right.rowIndex,
    )
    .map(({ rowIndex: _rowIndex, ...row }) => row);
}

/**
 * Takes the longest leading run whose summed cost stays within a satoshi budget.
 *
 * @param items - Values in the order they must be kept.
 * @param cost - Whole-satoshi cost, or null to end the prefix.
 * @param budgetSats - Largest permitted sum.
 * @returns A new array containing the fitting prefix.
 */
export function fittingPrefix<T>(
  items: readonly T[],
  cost: (item: T) => number | null,
  budgetSats: number,
): T[] {
  const kept: T[] = [];
  let total = 0;
  for (const item of items) {
    const itemCost = cost(item);
    if (itemCost === null || total + itemCost > budgetSats) {
      break;
    }
    kept.push(item);
    total += itemCost;
  }
  return kept;
}
