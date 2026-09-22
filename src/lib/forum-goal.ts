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
