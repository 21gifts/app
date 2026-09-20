/**
 * Account roles in rank order, lowest first: basis, verified, moderator, founder.
 *
 * Product rule: roles form a strict hierarchy founder > moderator > verified >
 * basis. A higher role can always do and see everything a lower role can; there
 * are no exceptions. Viewer permission checks use {@link roleAtLeast}; an
 * equality test on the viewer's role is a defect.
 */
export const ROLE_ORDER = ['basis', 'verified', 'moderator', 'founder'] as const;

/** One of {@link ROLE_ORDER}. */
export type Role = (typeof ROLE_ORDER)[number];

/**
 * Numeric rank of a role in {@link ROLE_ORDER} (0 for basis, 3 for founder).
 *
 * @param role - A live account role.
 * @returns Rank from 0 through 3.
 */
export function roleRank(role: Role): number {
  return ROLE_ORDER.indexOf(role);
}

/**
 * True when `role` is `min` or higher in the founder > moderator > verified >
 * basis hierarchy.
 *
 * `null` and `undefined` are never at least `min`.
 *
 * @param role - Viewer role, or missing when the account snapshot is absent.
 * @param min - Inclusive minimum role.
 * @returns Whether the viewer meets the minimum.
 */
export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  if (role === null || role === undefined) {
    return false;
  }
  return roleRank(role) >= roleRank(min);
}

/**
 * True when the signed-in account may reply without paying.
 *
 * Anyone at least verified is exempt. Basis, including the parent author, must
 * pay 1 sat to 21.gifts to write.
 *
 * @param account - Live account, or `null` when the snapshot is missing.
 * @param parentAccountId - Parent note `accountId`, if the api sent one.
 *   Missing id is not treated as exempt; the caller may POST unpaid and map 403.
 * @returns Whether `POST /messages` is allowed without a zap.
 */
export function isReplyPaymentExempt(
  account: { id: string; role: Role } | null,
  parentAccountId: string | undefined,
): boolean {
  void parentAccountId;
  if (account === null) {
    return false;
  }
  return roleAtLeast(account.role, 'verified');
}
