import { separatorsFor, type NumberFormatStyle } from '@/lib/number-format';
import { parseAmountDraft, type FiatCode, type FiatRateDay } from '@/lib/stats-money';

/** Maximum whole-sat ask a member may set on a top-level note. */
export const FORUM_GOAL_SATS_MAX = 10_000_000;

/**
 * Parse a composer Ask draft into a whole-sat goal.
 *
 * Empty, non-digits, zero, or values above {@link FORUM_GOAL_SATS_MAX} are
 * not a goal.
 *
 * @param raw - Field value.
 * @returns Whole sats in 1..{@link FORUM_GOAL_SATS_MAX}, or `null`.
 */
export function parseForumAskAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > FORUM_GOAL_SATS_MAX) {
    return null;
  }
  return parsed;
}

/**
 * Integer percent for a forum goal label. Uncapped (110, 250, …).
 *
 * Uses `Math.floor((sats * 100) / goalSats)` when `goalSats` is a positive
 * finite number. Returns 0 when the goal is missing, not finite, or `<= 0`.
 * Negative or non-finite collected sats count as 0 (no negative percent).
 *
 * @param sats - Collected sats on the note.
 * @param goalSats - Whole-sat goal; not positive → 0.
 * @returns Floored percent for the label.
 */
export function forumGoalPercent(sats: number, goalSats: number): number {
  if (!Number.isFinite(goalSats) || goalSats <= 0) {
    return 0;
  }
  const collected = Number.isFinite(sats) && sats > 0 ? sats : 0;
  return Math.floor((collected * 100) / goalSats);
}

const COLLECTED_FIAT_RE = /^\d+\.\d{2}$/;
const GOAL_AMOUNT_RE = /^\d+(\.\d{1,8})?$/;
const SCALE_8 = 100000000n;

/**
 * Scale a decimal string to 8 fraction digits as a BigInt.
 * Integer part times 10^8 plus the fraction padded right with zeros.
 *
 * @param raw - Digits with an optional fraction of 1–8 places.
 * @returns Scaled integer, or `null` when `raw` is not that shape.
 */
function scaleDecimalTo8(raw: string): bigint | null {
  if (!GOAL_AMOUNT_RE.test(raw)) {
    return null;
  }
  const dot = raw.indexOf('.');
  const whole = dot === -1 ? raw : raw.slice(0, dot);
  const frac = (dot === -1 ? '' : raw.slice(dot + 1)).padEnd(8, '0');
  return BigInt(whole) * SCALE_8 + BigInt(frac);
}

/**
 * Integer percent for a fiat Ask. Uncapped (110, 250, …).
 *
 * Scales both strings to 8 decimal places with BigInt (no IEEE float).
 * Unusable collected (`null`, `undefined`, or not two decimals) is 0.
 * Unusable `goalAmount` or a zero scaled goal is 0. The quotient is the
 * BigInt floor; `Number` only when that floor is a safe integer.
 *
 * @param collected - Payment snapshot for the definition code (`"5.06"`).
 * @param goalAmount - Defined amount string (`"200"` / `"10.125"`).
 * @returns Floored percent for the label.
 */
export function forumFiatGoalPercent(
  collected: string | null | undefined,
  goalAmount: string,
): number {
  if (collected === null || collected === undefined || !COLLECTED_FIAT_RE.test(collected)) {
    return 0;
  }
  const collectedScaled = scaleDecimalTo8(collected);
  const goalScaled = scaleDecimalTo8(goalAmount);
  if (collectedScaled === null || goalScaled === null || goalScaled <= 0n) {
    return 0;
  }
  const quotient = (collectedScaled * 100n) / goalScaled;
  if (quotient > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(quotient);
}

function groupIntegerDigits(digits: string, grouping: string): string {
  const parts: string[] = [];
  let remaining = digits;
  while (remaining.length > 3) {
    parts.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  parts.unshift(remaining);
  return parts.join(grouping);
}

/**
 * Format a typed or stored Ask definition amount for the goal line.
 *
 * Prefix is `$` for USD and `CODE ` otherwise. At most two fraction digits
 * in the string (including a hanging `.` or `,`) pad to two; more than two
 * keep every digit with no rounding. A single comma is the decimal mark.
 * Grouping comes from {@link separatorsFor}, not `Number` and not the
 * two-decimal fiat display helper. Unusable input is `''` so the caller can omit
 * the defined-fiat part.
 *
 * @param amount - Typed or stored amount (`"200"` / `"10,125"`).
 * @param code - Definition fiat.
 * @param style - Visitor grouping style.
 * @returns Prefixed display string, or `''`.
 */
export function formatDefinedGoalAmount(
  amount: string,
  code: FiatCode,
  style: NumberFormatStyle,
): string {
  const trimmed = amount.trim();
  if (trimmed === '') {
    return '';
  }
  const comma = trimmed.indexOf(',');
  const dot = trimmed.indexOf('.');
  if (comma !== -1 && dot !== -1) {
    return '';
  }
  const normalized =
    comma === -1 ? trimmed : `${trimmed.slice(0, comma)}.${trimmed.slice(comma + 1)}`;
  if (!/^\d+(\.\d*)?$/.test(normalized)) {
    return '';
  }
  const sep = normalized.indexOf('.');
  const whole = sep === -1 ? normalized : normalized.slice(0, sep);
  const fraction = sep === -1 ? '' : normalized.slice(sep + 1);
  const displayFraction = fraction.length <= 2 ? fraction.padEnd(2, '0') : fraction;
  const { grouping, decimal } = separatorsFor(style);
  const prefix = code === 'USD' ? '$' : `${code} `;
  return `${prefix}${groupIntegerDigits(whole, grouping)}${decimal}${displayFraction}`;
}

/**
 * Parse an Ask draft in the active typing unit.
 *
 * Bitcoin keeps {@link parseForumAskAmount}. Fiat converts with
 * {@link parseAmountDraft} and then the same 1..{@link FORUM_GOAL_SATS_MAX}
 * range.
 *
 * @param raw - Field value.
 * @param unit - `btc` or `fiat`.
 * @param day - Gift day for fiat, or `null`.
 * @param code - Preferred fiat.
 * @returns Whole sats in range, or `null`.
 */
export function parseForumAskAmountInUnit(
  raw: string,
  unit: 'btc' | 'fiat',
  day: FiatRateDay | null,
  code: FiatCode,
): number | null {
  if (unit === 'btc') {
    return parseForumAskAmount(raw);
  }
  const parsed = parseAmountDraft('fiat', raw, day, code);
  if (parsed.kind !== 'sats' || !Number.isSafeInteger(parsed.sats)) {
    return null;
  }
  if (parsed.sats < 1 || parsed.sats > FORUM_GOAL_SATS_MAX) {
    return null;
  }
  return parsed.sats;
}
