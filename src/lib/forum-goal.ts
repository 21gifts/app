/** Maximum whole-sat ask a member may set on a top-level note. */
export const FORUM_GOAL_SATS_MAX = 10_000_000;

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
