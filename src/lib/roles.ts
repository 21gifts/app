/**
 * Account roles as membership order, not the rank sequence: basis, verified,
 * moderator, initiator, founder.
 *
 * Numeric ranks: basis 0, verified 1, moderator 2, initiator 2, founder 3.
 * Viewer permission checks use {@link roleAtLeast}; an equality test on the
 * viewer's role is a defect. Do not write "moderator or initiator" or
 * „Moderator oder Initiator“; permission checks name the minimum rank only.
 */
export const ROLE_ORDER = ['basis', 'verified', 'moderator', 'initiator', 'founder'] as const;

/** One of {@link ROLE_ORDER}. */
export type Role = (typeof ROLE_ORDER)[number];

const ROLE_RANK: Record<Role, number> = {
  basis: 0,
  verified: 1,
  moderator: 2,
  initiator: 2,
  founder: 3,
};

/**
 * Numeric rank of a role from the explicit rank map (not {@link ROLE_ORDER}'s
 * index).
 *
 * @param role - A live account role.
 * @returns Rank from 0 through 3.
 */
export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

/**
 * True when `role` meets or exceeds `min` by numeric rank. An equal rank
 * meets the minimum.
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
