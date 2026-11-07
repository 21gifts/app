import type { AccountActivity } from '@/lib/api-types';
import type { FiatCode } from '@/lib/stats-money';

/** Money unit for the profile activity chart. */
export type ActivityScale = 'sat' | 'fiat';

/** One aligned UTC day on the dual Given/Received series. */
export interface ActivityPoint {
  /** Calendar day `YYYY-MM-DD`. */
  day: string;
  /** Cumulative given sats through this day. */
  cumulativeDonatedSats: number;
  /** Cumulative received sats through this day. */
  cumulativeReceivedSats: number;
  /** Cumulative given USD through this day (parsed from `cumulativeUsd`). */
  cumulativeDonatedUsd: number;
  /** Cumulative received USD through this day. */
  cumulativeReceivedUsd: number;
  /** Cumulative given CHF through this day (`null` source → `0`). */
  cumulativeDonatedChf: number;
  /** Cumulative received CHF through this day (`null` source → `0`). */
  cumulativeReceivedChf: number;
  /** Cumulative given EUR through this day (`null` source → `0`). */
  cumulativeDonatedEur: number;
  /** Cumulative received EUR through this day (`null` source → `0`). */
  cumulativeReceivedEur: number;
  /** Cumulative given PHP through this day (`null` source → `0`). */
  cumulativeDonatedPhp: number;
  /** Cumulative received PHP through this day (`null` source → `0`). */
  cumulativeReceivedPhp: number;
}

/**
 * Parses a nullable API fiat cumulative as a chart number.
 *
 * @param value - Two-decimal string, or `null` when unsummed.
 * @returns `Number(value)`, or `0` when `value` is `null`.
 */
function parseOptionalFiat(value: string | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * Reads one fiat cumulative from an aligned point.
 *
 * @param point - Aligned activity point.
 * @param series - Which cumulative series to read.
 * @param fiat - Selected fiat code.
 * @returns The cumulative value for that series and code.
 */
function cumulativeForFiat(
  point: ActivityPoint,
  series: 'donated' | 'received',
  fiat: FiatCode,
): number {
  const donated = series === 'donated';
  switch (fiat) {
    case 'USD':
      return donated ? point.cumulativeDonatedUsd : point.cumulativeReceivedUsd;
    case 'CHF':
      return donated ? point.cumulativeDonatedChf : point.cumulativeReceivedChf;
    case 'EUR':
      return donated ? point.cumulativeDonatedEur : point.cumulativeReceivedEur;
    case 'PHP':
      return donated ? point.cumulativeDonatedPhp : point.cumulativeReceivedPhp;
  }
}

/**
 * Align receive + donate series onto one UTC-day axis.
 *
 * Both series come from account activity (`receivedOverTime` / `donatedOverTime`).
 * Empty donated → donated cumulatives are 0 on every received day (same days, no fake
 * extra calendar). Empty received and empty donated → `[]`. When both series are
 * non-empty, days are the sorted union; cumulatives step-hold on gap days (a day
 * present in only one series contributes 0 that day to the other; cumulative carries
 * forward). CHF/EUR/PHP `null` strings become `0` for scale.
 *
 * @param received - Cumulative receive series (`receivedOverTime`).
 * @param donated - Cumulative give series (`donatedOverTime`); pass `[]` when none.
 * @returns Aligned points sorted by day, or `[]` when both inputs are empty.
 */
export function alignActivitySeries(
  received: AccountActivity['receivedOverTime'],
  donated: AccountActivity['donatedOverTime'],
): ActivityPoint[] {
  if (received.length === 0 && donated.length === 0) {
    return [];
  }
  const receivedByDay = new Map(received.map((point) => [point.day, point]));
  const donatedByDay = new Map(donated.map((point) => [point.day, point]));
  const days = [...new Set([...receivedByDay.keys(), ...donatedByDay.keys()])].sort();

  let cumulativeDonatedSats = 0;
  let cumulativeReceivedSats = 0;
  let cumulativeDonatedUsd = 0;
  let cumulativeReceivedUsd = 0;
  let cumulativeDonatedChf = 0;
  let cumulativeReceivedChf = 0;
  let cumulativeDonatedEur = 0;
  let cumulativeReceivedEur = 0;
  let cumulativeDonatedPhp = 0;
  let cumulativeReceivedPhp = 0;

  return days.map((day) => {
    const donatedPoint = donatedByDay.get(day);
    const receivedPoint = receivedByDay.get(day);
    if (donatedPoint !== undefined) {
      cumulativeDonatedSats = donatedPoint.cumulativeSats;
      cumulativeDonatedUsd = Number(donatedPoint.cumulativeUsd);
      cumulativeDonatedChf = parseOptionalFiat(donatedPoint.cumulativeChf);
      cumulativeDonatedEur = parseOptionalFiat(donatedPoint.cumulativeEur);
      cumulativeDonatedPhp = parseOptionalFiat(donatedPoint.cumulativePhp);
    }
    if (receivedPoint !== undefined) {
      cumulativeReceivedSats = receivedPoint.cumulativeSats;
      cumulativeReceivedUsd = Number(receivedPoint.cumulativeUsd);
      cumulativeReceivedChf = parseOptionalFiat(receivedPoint.cumulativeChf);
      cumulativeReceivedEur = parseOptionalFiat(receivedPoint.cumulativeEur);
      cumulativeReceivedPhp = parseOptionalFiat(receivedPoint.cumulativePhp);
    }
    return {
      day,
      cumulativeDonatedSats,
      cumulativeReceivedSats,
      cumulativeDonatedUsd,
      cumulativeReceivedUsd,
      cumulativeDonatedChf,
      cumulativeReceivedChf,
      cumulativeDonatedEur,
      cumulativeReceivedEur,
      cumulativeDonatedPhp,
      cumulativeReceivedPhp,
    };
  });
}

/**
 * Numeric chart value for one series at one aligned point.
 *
 * `scale === 'sat'` ignores `fiat`. `scale === 'fiat'` reads the matching
 * cumulative; callers always pass `fiat` in that case (`USD` if omitted).
 *
 * @param point - Aligned activity point.
 * @param series - Which cumulative series to read.
 * @param scale - Sat or fiat axis.
 * @param fiat - Selected fiat when `scale` is `'fiat'`.
 * @returns The cumulative value for that series and scale.
 */
export function activityValue(
  point: ActivityPoint,
  series: 'donated' | 'received',
  scale: ActivityScale,
  fiat?: FiatCode,
): number {
  if (scale === 'sat') {
    return series === 'donated' ? point.cumulativeDonatedSats : point.cumulativeReceivedSats;
  }
  return cumulativeForFiat(point, series, fiat ?? 'USD');
}

/**
 * Y max used for scale: max of both series, or `1` when all zeros (or empty).
 *
 * `scale === 'sat'` ignores `fiat`. `scale === 'fiat'` reads the selected code
 * (callers always pass `fiat` then).
 *
 * @param points - Aligned activity points.
 * @param scale - Sat or fiat axis.
 * @param fiat - Selected fiat when `scale` is `'fiat'`.
 * @returns Positive max used to place polylines.
 */
export function activityMaxY(
  points: ActivityPoint[],
  scale: ActivityScale,
  fiat?: FiatCode,
): number {
  if (points.length === 0) {
    return 1;
  }
  let max = 0;
  for (const point of points) {
    max = Math.max(
      max,
      activityValue(point, 'donated', scale, fiat),
      activityValue(point, 'received', scale, fiat),
    );
  }
  return max === 0 ? 1 : max;
}

/** One aligned UTC day on the dual Debt/Credit loan series. */
export interface LoanPoint {
  /** Calendar day `YYYY-MM-DD`. */
  day: string;
  /** Cumulative owed sats through this day (may be negative). */
  cumulativeOwedSats: number;
  /** Cumulative credit sats through this day (may be negative). */
  cumulativeCreditSats: number;
  /** Cumulative owed USD through this day (parsed from `cumulativeUsd`). */
  cumulativeOwedUsd: number;
  /** Cumulative credit USD through this day. */
  cumulativeCreditUsd: number;
  /** Cumulative owed CHF through this day (`null` source → `0`). */
  cumulativeOwedChf: number;
  /** Cumulative credit CHF through this day (`null` source → `0`). */
  cumulativeCreditChf: number;
  /** Cumulative owed EUR through this day (`null` source → `0`). */
  cumulativeOwedEur: number;
  /** Cumulative credit EUR through this day (`null` source → `0`). */
  cumulativeCreditEur: number;
  /** Cumulative owed PHP through this day (`null` source → `0`). */
  cumulativeOwedPhp: number;
  /** Cumulative credit PHP through this day (`null` source → `0`). */
  cumulativeCreditPhp: number;
}

/**
 * Reads one fiat cumulative from an aligned loan point.
 *
 * @param point - Aligned loan point.
 * @param series - Which cumulative series to read.
 * @param fiat - Selected fiat code.
 * @returns The cumulative value for that series and code.
 */
function loanCumulativeForFiat(
  point: LoanPoint,
  series: 'owed' | 'credit',
  fiat: FiatCode,
): number {
  const owed = series === 'owed';
  switch (fiat) {
    case 'USD':
      return owed ? point.cumulativeOwedUsd : point.cumulativeCreditUsd;
    case 'CHF':
      return owed ? point.cumulativeOwedChf : point.cumulativeCreditChf;
    case 'EUR':
      return owed ? point.cumulativeOwedEur : point.cumulativeCreditEur;
    case 'PHP':
      return owed ? point.cumulativeOwedPhp : point.cumulativeCreditPhp;
  }
}

/**
 * Align owed + credit loan series onto one UTC-day axis.
 *
 * Both series come from account activity (`owedOverTime` / `creditOverTime`).
 * Empty credit → credit cumulatives are 0 on every owed day (same days, no fake
 * extra calendar). Empty owed and empty credit → `[]`. When both series are
 * non-empty, days are the sorted union; cumulatives step-hold on gap days.
 * CHF/EUR/PHP `null` strings become `0` for scale. Negative `cumulativeSats`
 * and `cumulativeUsd` are kept as-is.
 *
 * @param owed - Cumulative debt series (`owedOverTime`).
 * @param credit - Cumulative credit series (`creditOverTime`); pass `[]` when none.
 * @returns Aligned points sorted by day, or `[]` when both inputs are empty.
 */
export function alignLoanSeries(
  owed: NonNullable<AccountActivity['owedOverTime']>,
  credit: NonNullable<AccountActivity['creditOverTime']>,
): LoanPoint[] {
  if (owed.length === 0 && credit.length === 0) {
    return [];
  }
  const owedByDay = new Map(owed.map((point) => [point.day, point]));
  const creditByDay = new Map(credit.map((point) => [point.day, point]));
  const days = [...new Set([...owedByDay.keys(), ...creditByDay.keys()])].sort();

  let cumulativeOwedSats = 0;
  let cumulativeCreditSats = 0;
  let cumulativeOwedUsd = 0;
  let cumulativeCreditUsd = 0;
  let cumulativeOwedChf = 0;
  let cumulativeCreditChf = 0;
  let cumulativeOwedEur = 0;
  let cumulativeCreditEur = 0;
  let cumulativeOwedPhp = 0;
  let cumulativeCreditPhp = 0;

  return days.map((day) => {
    const owedPoint = owedByDay.get(day);
    const creditPoint = creditByDay.get(day);
    if (owedPoint !== undefined) {
      cumulativeOwedSats = owedPoint.cumulativeSats;
      cumulativeOwedUsd = Number(owedPoint.cumulativeUsd);
      cumulativeOwedChf = parseOptionalFiat(owedPoint.cumulativeChf);
      cumulativeOwedEur = parseOptionalFiat(owedPoint.cumulativeEur);
      cumulativeOwedPhp = parseOptionalFiat(owedPoint.cumulativePhp);
    }
    if (creditPoint !== undefined) {
      cumulativeCreditSats = creditPoint.cumulativeSats;
      cumulativeCreditUsd = Number(creditPoint.cumulativeUsd);
      cumulativeCreditChf = parseOptionalFiat(creditPoint.cumulativeChf);
      cumulativeCreditEur = parseOptionalFiat(creditPoint.cumulativeEur);
      cumulativeCreditPhp = parseOptionalFiat(creditPoint.cumulativePhp);
    }
    return {
      day,
      cumulativeOwedSats,
      cumulativeCreditSats,
      cumulativeOwedUsd,
      cumulativeCreditUsd,
      cumulativeOwedChf,
      cumulativeCreditChf,
      cumulativeOwedEur,
      cumulativeCreditEur,
      cumulativeOwedPhp,
      cumulativeCreditPhp,
    };
  });
}

/**
 * Numeric chart value for one loan series at one aligned point.
 *
 * `scale === 'sat'` ignores `fiat`. `scale === 'fiat'` reads the matching
 * cumulative; callers always pass `fiat` in that case (`USD` if omitted).
 *
 * @param point - Aligned loan point.
 * @param series - Which cumulative series to read.
 * @param scale - Sat or fiat axis.
 * @param fiat - Selected fiat when `scale` is `'fiat'`.
 * @returns The cumulative value for that series and scale.
 */
export function loanValue(
  point: LoanPoint,
  series: 'owed' | 'credit',
  scale: ActivityScale,
  fiat?: FiatCode,
): number {
  if (scale === 'sat') {
    return series === 'owed' ? point.cumulativeOwedSats : point.cumulativeCreditSats;
  }
  return loanCumulativeForFiat(point, series, fiat ?? 'USD');
}

/**
 * Y-axis range for the loan chart: always includes 0; span is at least 1.
 *
 * `minY` is `min(0, all loanValue of both series)` (or `0` when empty).
 * `maxY` is `max(0, all loanValue of both series)` (or `0` when empty).
 * `span` is `maxY - minY`, or `1` when that difference is 0.
 *
 * @param points - Aligned loan points.
 * @param scale - Sat or fiat axis.
 * @param fiat - Selected fiat when `scale` is `'fiat'`.
 * @returns `{ minY, maxY, span }` for SVG placement.
 */
export function loanAxis(
  points: LoanPoint[],
  scale: ActivityScale,
  fiat?: FiatCode,
): { minY: number; maxY: number; span: number } {
  if (points.length === 0) {
    return { minY: 0, maxY: 0, span: 1 };
  }
  let minY = 0;
  let maxY = 0;
  for (const point of points) {
    const owed = loanValue(point, 'owed', scale, fiat);
    const credit = loanValue(point, 'credit', scale, fiat);
    minY = Math.min(minY, owed, credit);
    maxY = Math.max(maxY, owed, credit);
  }
  const span = maxY - minY;
  return { minY, maxY, span: span === 0 ? 1 : span };
}
