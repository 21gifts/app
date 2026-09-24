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
