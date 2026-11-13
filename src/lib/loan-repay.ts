import type { MyLoan, MyLoans, RepaymentLedger, RepaymentLine } from '@/lib/api';
import { creditSmallestUnits } from '@/lib/credit-plan';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import type { NumberFormatStyle } from '@/lib/number-format';

/** Parsed positive loan amount in the loan currency's smallest input unit. */
export interface ParsedLoanAmount {
  /** Whole sats for BTC or whole cents for fiat. */
  units: bigint;
  /** Trimmed user input, preserving a fiat comma or dot. */
  text: string;
}

/** Result of validating a free repayment amount against the api-provided maximum. */
export type LoanAmountCheck =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: 'empty' | 'invalid' | 'above_max' | 'no_max';
      max: string | null;
    };

function fiatUnits(input: string): bigint | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input);
  if (match === null) {
    return null;
  }
  const whole = match[1]!;
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return BigInt(whole) * 100n + BigInt(fraction);
}

/**
 * Parses a positive free repayment amount without floating-point arithmetic.
 *
 * @param input - User input; surrounding whitespace is ignored.
 * @param currency - BTC accepts whole sats, fiat accepts comma or dot and at most two decimals.
 * @returns Whole sats/cents plus the trimmed text, or null for empty, zero, negative, or malformed input.
 */
export function parseLoanAmount(
  input: string,
  currency: MyLoan['goalCurrency'],
): ParsedLoanAmount | null {
  const text = input.trim();
  if (text === '') {
    return null;
  }
  const units = currency === 'BTC' ? (/^\d+$/.test(text) ? BigInt(text) : null) : fiatUnits(text);
  return units === null || units <= 0n ? null : { units, text };
}

/**
 * Reads the api-provided maximum in the loan currency's smallest input unit.
 *
 * @param loan - Loan returned by `GET /me/loans`.
 * @returns Positive whole sats for BTC, positive whole cents for fiat, or null when a maximum or
 *   fiat rate is unavailable, zero, or malformed.
 */
export function loanMaxUnits(loan: MyLoan): bigint | null {
  if (loan.goalCurrency === 'BTC') {
    return loan.maxSats === null || loan.maxSats === undefined || loan.maxSats <= 0
      ? null
      : BigInt(loan.maxSats);
  }
  if (
    loan.maxSats === null ||
    loan.maxSats === undefined ||
    loan.maxSats <= 0 ||
    loan.maxAmount === null ||
    loan.maxAmount === undefined
  ) {
    return null;
  }
  const units = fiatUnits(loan.maxAmount.trim());
  return units === null || units <= 0n ? null : units;
}

/**
 * Validates a free repayment input and compares it with the api maximum.
 *
 * @param input - User-entered loan-currency amount.
 * @param loan - Loan that supplies the currency and current maximum.
 * @returns Normalized success text or a reason with the available maximum input string.
 */
export function checkLoanAmount(input: string, loan: MyLoan): LoanAmountCheck {
  const max = loanMaxInput(loan);
  if (input.trim() === '') {
    return { ok: false, reason: 'empty', max };
  }
  const parsed = parseLoanAmount(input, loan.goalCurrency);
  if (parsed === null) {
    return { ok: false, reason: 'invalid', max };
  }
  const maxUnits = loanMaxUnits(loan);
  if (maxUnits === null) {
    return { ok: false, reason: 'no_max', max: null };
  }
  if (parsed.units > maxUnits) {
    return { ok: false, reason: 'above_max', max };
  }
  return { ok: true, text: parsed.text };
}

/**
 * Supplies the exact value the free-repayment Max button puts in its input.
 *
 * @param loan - Loan returned by `GET /me/loans`.
 * @returns Positive integer max sats for BTC, the api's positive fiat max string while its rate is
 *   available, or null.
 */
export function loanMaxInput(loan: MyLoan): string | null {
  if (loan.goalCurrency === 'BTC') {
    return loan.maxSats === null || loan.maxSats === undefined || loan.maxSats <= 0
      ? null
      : String(loan.maxSats);
  }
  if (
    loan.maxSats === null ||
    loan.maxSats === undefined ||
    loan.maxSats <= 0 ||
    loan.maxAmount === null ||
    loan.maxAmount === undefined
  ) {
    return null;
  }
  const units = fiatUnits(loan.maxAmount.trim());
  return units === null || units <= 0n ? null : loan.maxAmount;
}

/**
 * Identifies a loan whose ask is still accepting contributions.
 *
 * @param loan - Loan returned by `GET /me/loans`.
 * @returns True only before both funding and an explicit close.
 */
export function isCollecting(loan: Pick<MyLoan, 'fundedAt' | 'closedAt'>): boolean {
  return loan.fundedAt === null && (loan.closedAt ?? null) === null;
}

/** Combined state of all of the member's loans, for the loans card, the Menu row and the screen. */
interface LoansSummaryCommon {
  /** Number of loans in the body. */
  count: number;
  /** Loans with `fundedAt !== null`. */
  fundedCount: number;
  /** Mirrors `sundayRest`. */
  sundayRest: boolean;
  /** Sum of known due.waitingSats, or null when no loan has known waiting sats. */
  waitingSats: number | null;
  /** Sum of due.waitingPeople. */
  waitingPeople: number;
  /** Largest due.behindDays. */
  behindDays: number;
  /** Number of loans with positive payable sats, or with unavailable sats and a payable person. */
  payableLoans: number;
  /** True when an active payable loan has due.lastPayment. */
  lastPayment: boolean;
  /**
   * Earliest next.dueOn among loans whose next is non-null. `sats` is the known sum for that day, or
   * null when every share lacks sats. The amount is the sum per fiat currency of every
   * stored next.amount string on that day, in first-seen currency order, joined with " + "; null
   * when a BTC loan, a missing string, or an invalid string keeps the total undefined.
   */
  next: { dueOn: string; sats: number | null; amount: string | null } | null;
  /**
   * Card outline: 'danger' when fundedCount \> 0 and behindDays \> 0; 'success' when fundedCount \> 0,
   * !sundayRest, and nobody is payable or waiting; otherwise 'neutral'.
   */
  tone: 'danger' | 'success' | 'neutral';
}

/** A payable summary always carries a known positive sat total; otherwise that total may be null. */
export type LoansSummary = LoansSummaryCommon &
  ({ payable: true; payableSats: number } | { payable: false; payableSats: number | null });

/**
 * Combines totals and display state across the member's loans.
 *
 * @param data - Body returned by `GET /me/loans`.
 * @param style - Visitor number format for a defined next amount.
 * @returns Totals, next due day, tone, and payable state.
 */
export function summarizeLoans(data: MyLoans, style: NumberFormatStyle): LoansSummary {
  let fundedCount = 0;
  let payableSats: number | null = null;
  let waitingSats: number | null = null;
  let waitingPeople = 0;
  let behindDays = 0;
  let payableLoans = 0;
  let lastPayment = false;
  let nextDueOn: string | null = null;
  let nextSats: number | null = null;

  for (const loan of data.loans) {
    const hasPayable =
      loan.due.payableSats === null ? loan.due.payablePeople > 0 : loan.due.payableSats > 0;
    if (loan.fundedAt !== null) {
      fundedCount += 1;
    }
    if (loan.due.payableSats !== null) {
      payableSats = (payableSats ?? 0) + loan.due.payableSats;
    }
    if (loan.due.waitingSats !== null) {
      waitingSats = (waitingSats ?? 0) + loan.due.waitingSats;
    }
    waitingPeople += loan.due.waitingPeople;
    behindDays = Math.max(behindDays, loan.due.behindDays);
    if (hasPayable) {
      payableLoans += 1;
      lastPayment ||= loan.due.lastPayment;
    }
    if (loan.next !== null) {
      if (nextDueOn === null || loan.next.dueOn < nextDueOn) {
        nextDueOn = loan.next.dueOn;
        nextSats = loan.next.sats;
      } else if (loan.next.dueOn === nextDueOn) {
        if (loan.next.sats !== null) {
          nextSats = (nextSats ?? 0) + loan.next.sats;
        }
      }
    }
  }

  let nextAmount: string | null = null;
  if (nextDueOn !== null) {
    const amounts: { code: MyLoan['goalCurrency']; amount: string | null }[] = [];
    for (const loan of data.loans) {
      if (loan.next !== null && loan.next.dueOn === nextDueOn) {
        amounts.push({ code: loan.goalCurrency, amount: loan.next.amount });
      }
    }
    nextAmount = definedFiatAmounts(amounts, style);
  }
  const next = nextDueOn === null ? null : { dueOn: nextDueOn, sats: nextSats, amount: nextAmount };

  const tone =
    fundedCount > 0 && behindDays > 0
      ? 'danger'
      : fundedCount > 0 &&
          !data.sundayRest &&
          payableLoans === 0 &&
          waitingPeople === 0 &&
          (waitingSats === null || waitingSats === 0)
        ? 'success'
        : 'neutral';
  const payable = !data.sundayRest && payableSats !== null && payableSats > 0;
  const payableState = payable
    ? { payable: true as const, payableSats: payableSats as number }
    : { payable: false as const, payableSats };
  return {
    count: data.loans.length,
    fundedCount,
    sundayRest: data.sundayRest,
    ...payableState,
    waitingSats,
    waitingPeople,
    behindDays,
    payableLoans,
    lastPayment,
    next,
    tone,
  };
}

/**
 * Sums stored fiat amount strings in one currency. Bitcoin, a missing currency,
 * and a missing amount yield null.
 *
 * @param code - Loan currency of every amount.
 * @param amounts - Stored amount strings to sum.
 * @param style - Visitor number format.
 * @returns The summed amount in that currency, or null.
 */
export function definedFiatSum(
  code: MyLoan['goalCurrency'] | undefined,
  amounts: readonly (string | null)[],
  style: NumberFormatStyle,
): string | null {
  if (code === undefined || code === 'BTC' || amounts.length === 0) {
    return null;
  }
  let cents = 0n;
  for (const amount of amounts) {
    if (amount === null) {
      return null;
    }
    const units = creditSmallestUnits(amount, false);
    if (units === null) {
      return null;
    }
    cents += units;
  }
  return formatDefinedGoalAmount(centsString(cents), code, style);
}

/**
 * Sums stored fiat amounts per currency and joins the formatted totals with
 * ` + ` in first-seen currency order. A bitcoin amount, a missing amount, or an
 * invalid amount makes the whole result null.
 *
 * @param amounts - Stored amount and currency pairs, in display order.
 * @param style - Visitor number format.
 * @returns For example `PHP 2.00 + $3.00`, or null when any part is undefined.
 */
export function definedFiatAmounts(
  amounts: readonly { code: MyLoan['goalCurrency']; amount: string | null }[],
  style: NumberFormatStyle,
): string | null {
  if (amounts.length === 0) {
    return null;
  }
  const byCode = new Map<Exclude<MyLoan['goalCurrency'], 'BTC'>, (string | null)[]>();
  for (const item of amounts) {
    if (item.code === 'BTC' || item.amount === null) {
      return null;
    }
    const group = byCode.get(item.code);
    if (group === undefined) {
      byCode.set(item.code, [item.amount]);
    } else {
      group.push(item.amount);
    }
  }
  const parts: string[] = [];
  for (const [code, group] of byCode) {
    const sum = definedFiatSum(code, group, style);
    if (sum === null) {
      return null;
    }
    parts.push(sum);
  }
  return parts.join(' + ');
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
  /** Remaining row.dueSats, or sats less paidSats for an older api; null if invalid. */
  sats: number | null;
  /** Remaining row.amount after paidAmount when the ledger uses the loan currency. */
  amount: string | null;
  /**
   * row.waiting: the giver cannot receive yet, so the share is not sent now. Without it
   * (older api), the giver's givers[].canReceive is false (a giver not listed can receive).
   */
  waiting: boolean;
}

/** Validated partial payment of one repayment row, in whole sats and cents. */
export interface ValidatedRepaymentPayment {
  /** Paid sats, or null when positive paid sats cannot be bounded by the original sats. */
  sats: bigint | null;
  /** Paid cents, or null when the stored fiat relationship is missing or invalid. */
  amount: bigint | null;
  /** Whether the api supplied a non-null stored paid fiat amount. */
  hasAmount: boolean;
}

/**
 * Validates the partial-payment fields of one repayment row.
 *
 * Missing paid fields mean zero only while no positive satoshi payment needs a
 * matching fiat amount. A positive fiat payment requires matching positive
 * valid sats. A malformed or overpaid fiat amount stays independent from valid
 * sats, so callers can fall back to bitcoin. Invalid paid sats also invalidate
 * the fiat side, because the row's payment is then unknown.
 *
 * @param row - Repayment row with its original and partial-payment values.
 * @returns Validated whole sats/cents; null marks an unavailable relationship.
 */
export function validatedRepaymentPayment(
  row: Pick<RepaymentLine, 'sats' | 'paidSats' | 'amount' | 'paidAmount'>,
): ValidatedRepaymentPayment {
  const paidSats = row.paidSats ?? 0;
  const satsValid =
    Number.isSafeInteger(paidSats) &&
    paidSats >= 0 &&
    (paidSats === 0 ||
      (row.sats !== null && Number.isSafeInteger(row.sats) && row.sats >= paidSats));
  const sats = satsValid ? BigInt(paidSats) : null;
  const totalAmount = row.amount === null ? null : fiatUnits(row.amount.trim());
  const hasAmount = row.paidAmount !== null && row.paidAmount !== undefined;
  const paidAmount = !hasAmount ? (sats === 0n ? 0n : null) : fiatUnits(row.paidAmount!.trim());
  const amount =
    sats === null ||
    totalAmount === null ||
    paidAmount === null ||
    paidAmount > totalAmount ||
    (paidAmount > 0n && sats === 0n)
      ? null
      : paidAmount;
  return { sats, amount, hasAmount };
}

/**
 * Returns the remaining bitcoin amount for one repayment line.
 *
 * `dueSats` is authoritative when present. Older api bodies omit it, so a
 * partial row falls back to its original sats less the paid sats. An invalid
 * relationship never becomes a negative or otherwise invented remainder.
 *
 * @param row - Repayment line with original, paid, and optional due sats.
 * @returns Remaining whole sats, or null when the relationship is unknown or invalid.
 */
export function remainingRepaymentSats(
  row: Pick<RepaymentLine, 'sats' | 'paidSats' | 'dueSats'>,
): number | null {
  const payment = validatedRepaymentPayment({ ...row, amount: null, paidAmount: null });
  if (payment.sats === null) {
    return null;
  }
  if (row.dueSats !== null && row.dueSats !== undefined) {
    return row.dueSats;
  }
  return row.sats === null ? null : Number(BigInt(row.sats) - payment.sats);
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
      const payment = validatedRepaymentPayment(row);
      rows.push({
        messageId: loan.messageId,
        loanIndex,
        dayIndex: row.dayIndex,
        dueOn: row.dueOn,
        accountId: row.accountId,
        name: row.name,
        sats: remainingRepaymentSats(row),
        amount:
          ledger.currency !== loan.goalCurrency ||
          loan.goalCurrency === 'BTC' ||
          row.amount === null
            ? null
            : (() => {
                const total = creditSmallestUnits(row.amount, false);
                return total === null || payment.amount === null
                  ? null
                  : centsString(total - payment.amount);
              })(),
        waiting: row.waiting ?? canReceive.get(row.accountId) === false,
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
    .map((row) => ({
      messageId: row.messageId,
      loanIndex: row.loanIndex,
      dayIndex: row.dayIndex,
      dueOn: row.dueOn,
      accountId: row.accountId,
      name: row.name,
      sats: row.sats,
      amount: row.amount,
      waiting: row.waiting,
    }));
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

/**
 * Writes whole cents as a two-decimal amount string.
 *
 * @param cents - Amount in hundredths of the currency.
 * @returns For example `30.00` for 3000 cents.
 */
export function centsString(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, '0');
  return `${whole}.${fraction}`;
}

/**
 * The stored fiat figure of what is payable or waiting across loans. The stored
 * amounts are summed per currency and joined in first-seen order, like the
 * sending line; otherwise the caller shows bitcoin with the current spot.
 *
 * @param loans - Loans of `GET /me/loans`.
 * @param part - `payable` (`due.payableAmount`) or `waiting` (`due.waitingAmount`).
 * @param style - Visitor number format.
 * @returns The per-currency sums (for example `₱30.00 + $3.00`), or null.
 */
export function definedDueLabel(
  loans: readonly MyLoan[],
  part: 'payable' | 'waiting',
  style: NumberFormatStyle,
): string | null {
  const active = loans.filter((loan) => {
    const sats = loan.due[`${part}Sats`];
    return sats === null ? loan.due[`${part}People`] > 0 : sats > 0;
  });
  return definedFiatAmounts(
    active.map((loan) => ({ code: loan.goalCurrency, amount: loan.due[`${part}Amount`] })),
    style,
  );
}
